import { hashCode } from "../../core/hash.js";
import { SEMANTIC_POSITION } from "../../platform/graphics/constants.js";
import { ShaderUtils } from "../../platform/graphics/shader-utils.js";
import { DITHER_NONE } from "../constants.js";
import { shaderChunks } from "../shader-lib/chunks/chunks.js";
import { ShaderGenerator } from "../shader-lib/programs/shader-generator.js";
import { ShaderPass } from "../shader-pass.js";

const splatCoreVS = `
    uniform mat4 matrix_model;
    uniform mat4 matrix_view;
    uniform mat4 matrix_projection;
    uniform mat4 matrix_viewProjection;

    uniform vec2 viewport;

    varying vec2 texCoord;
    varying vec4 color;
    varying float id;

    uniform vec4 tex_params;
    uniform sampler2D splatColor;

    uniform highp sampler2D transformA;
    uniform highp sampler2D transformB;
    uniform highp sampler2D transformC;

    vec3 center;
    vec3 covA;
    vec3 covB;

    attribute uint vertex_id;
    ivec2 dataUV;
    void evalDataUV() {

        // turn vertex_id into int grid coordinates
        ivec2 textureSize = ivec2(tex_params.xy);
        vec2 invTextureSize = tex_params.zw;

        int gridV = int(float(vertex_id) * invTextureSize.x);
        int gridU = int(vertex_id) - gridV * textureSize.x;
        dataUV = ivec2(gridU, gridV);
    }

    vec4 getColor() {
        return texelFetch(splatColor, dataUV, 0);
    }

    void getTransform() {
        vec4 tA = texelFetch(transformA, dataUV, 0);
        vec4 tB = texelFetch(transformB, dataUV, 0);
        vec4 tC = texelFetch(transformC, dataUV, 0);

        center = tA.xyz;
        covA = tB.xyz;
        covB = vec3(tA.w, tB.w, tC.x);
    }

    vec3 evalCenter() {
        evalDataUV();

        // get data
        getTransform();

        return center;
    }

    vec4 evalSplat(vec4 centerWorld)
    {
        vec4 splat_cam = matrix_view * centerWorld;
        vec4 splat_proj = matrix_projection * splat_cam;

        // cull behind camera
        if (splat_proj.z < -splat_proj.w) {
            return vec4(0.0, 0.0, 2.0, 1.0);
        }

        id = float(vertex_id);
        color = getColor();

        mat3 Vrk = mat3(
            covA.x, covA.y, covA.z, 
            covA.y, covB.x, covB.y,
            covA.z, covB.y, covB.z
        );

        float focal = viewport.x * matrix_projection[0][0];

        float J1 = focal / splat_cam.z;
        vec2 J2 = -J1 / splat_cam.z * splat_cam.xy;
        mat3 J = mat3(
            J1, 0., J2.x, 
            0., J1, J2.y, 
            0., 0., 0.
        );

        mat3 W = transpose(mat3(matrix_view) * mat3(matrix_model));

        mat3 T = W * J;
        mat3 cov = transpose(T) * Vrk * T;

        float diagonal1 = cov[0][0] + 0.3;
        float offDiagonal = cov[0][1];
        float diagonal2 = cov[1][1] + 0.3;

        float mid = 0.5 * (diagonal1 + diagonal2);
        float radius = length(vec2((diagonal1 - diagonal2) / 2.0, offDiagonal));
        float lambda1 = mid + radius;
        float lambda2 = max(mid - radius, 0.1);
        vec2 diagonalVector = normalize(vec2(offDiagonal, lambda1 - diagonal1));
        vec2 v1 = min(sqrt(2.0 * lambda1), 1024.0) * diagonalVector;
        vec2 v2 = min(sqrt(2.0 * lambda2), 1024.0) * vec2(diagonalVector.y, -diagonalVector.x);

        // early out tiny splats
        // TODO: figure out length units and expose as uniform parameter
        // TODO: perhaps make this a shader compile-time option
        if (dot(v1, v1) < 4.0 && dot(v2, v2) < 4.0) {
            return vec4(0.0, 0.0, 2.0, 1.0);
        }

        int vertexIndex = int(gl_VertexID) % 4;
        texCoord = vec2(
            float((vertexIndex == 0 || vertexIndex == 3) ? -2 : 2),
            float((vertexIndex == 0 || vertexIndex == 1) ? -2 : 2)
        );

        splat_proj.xy += (texCoord.x * v1 + texCoord.y * v2) / viewport * splat_proj.w;
        return splat_proj;
    }
`;

const splatCoreFS = /* glsl_ */ `
    varying vec2 texCoord;
    varying vec4 color;
    varying float id;

    #ifdef PICK_PASS
        uniform vec4 uColor;
    #endif

    vec4 evalSplat() {

        #ifdef DEBUG_RENDER

            if (color.a < 0.2) discard;
            return color;

        #else

            float A = -dot(texCoord, texCoord);
            if (A < -4.0) discard;
            float B = exp(A) * color.a;

            #ifdef PICK_PASS
                if (B < 0.3) discard;
                return(uColor);
            #endif

            #ifndef DITHER_NONE
                opacityDither(B, id * 0.013);
            #endif

            // the color here is in gamma space, so bring it to linear
            vec3 diffuse = decodeGamma(color.rgb);

            // apply tone-mapping and gamma correction as needed
            diffuse = toneMap(diffuse);
            diffuse = gammaCorrectOutput(diffuse);

            return vec4(diffuse, B);

        #endif
    }
`;

class GShaderGeneratorSplat {
    generateKey(options) {
        const vsHash = hashCode(options.vertex);
        const fsHash = hashCode(options.fragment);
        return `splat-${options.pass}-${options.gamma}-${options.toneMapping}-${vsHash}-${fsHash}-${options.debugRender}-${options.dither}}`;
    }

    createShaderDefinition(device, options) {

        const shaderPassInfo = ShaderPass.get(device).getByIndex(options.pass);
        const shaderPassDefines = shaderPassInfo.shaderDefines;

        const defines =
            shaderPassDefines +
            (options.debugRender ? '#define DEBUG_RENDER\n' : '') +
            `#define DITHER_${options.dither.toUpperCase()}\n`;

        const vs = defines + splatCoreVS + options.vertex;
        const fs = defines + shaderChunks.decodePS +
            (options.dither === DITHER_NONE ? '' : shaderChunks.bayerPS + shaderChunks.opacityDitherPS) +
            ShaderGenerator.tonemapCode(options.toneMapping) +
            ShaderGenerator.gammaCode(options.gamma) +
            splatCoreFS + options.fragment;

        return ShaderUtils.createDefinition(device, {
            name: 'SplatShader',
            attributes: {
                vertex_id: SEMANTIC_POSITION
            },
            vertexCode: vs,
            fragmentCode: fs
        });
    }
}

const gsplat = new GShaderGeneratorSplat();

export { gsplat };
