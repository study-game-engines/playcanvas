import config from '@examples/config';
import { fetchFile, fire } from '@examples/utils';
import { data, refresh } from '@examples/observer';
import files from '@examples/files';

import MiniStats from './ministats.mjs';

class ExampleLoader {
    /**
     * @type {import('playcanvas').AppBase}
     * @private
     */
    _app;

    /**
     * @type {boolean}
     * @private
     */
    _started = false;

    /**
     * @type {boolean}
     * @private
     */
    _allowRestart = true;

    /**
     * @type {string}
     * @private
     */
    _scriptUrl = '';

    /**
     * @type {Function | null}
     * @private
     */
    _scriptDestroy = null;

    /**
     * @type {boolean}
     */
    ready = false;

    _appStart() {
        if (this._app) {
            if (!this._app?.graphicsDevice?.canvas) {
                console.warn('No canvas found.');
                return;
            }
            MiniStats.enable(this._app, true);
        }

        if (!this._started) {
            // Sets code editor component files
            // Sets example component files (for controls + description)
            // Sets mini stats enabled state based on UI
            fire('exampleLoad', { observer: data, files, description: config.DESCRIPTION || '' });
        }
        this._started = true;

        // Updates controls UI
        fire('updateFiles', { observer: data, files });

        if (this._app) {
            // Updates device UI
            fire('updateActiveDevice', { deviceType: this._app?.graphicsDevice?.deviceType });
        }

        this._allowRestart = true;
    }

    _parseErrorLocations(stack) {
        const lines = stack.split('\n');
        const locations = [];
        lines.forEach((line) => {
            const match = /^\s*at\s(.+):(\d+):(\d+)$/g.exec(line);
            if (!match) {
                return;
            }
            locations.push({
                file: match[1],
                line: +match[2],
                column: +match[3]
            });
        });
        return locations;
    }

    /**
     * @param {{ engineUrl: string, exampleUrl: string, controlsUrl: string }} options - Options to start the loader
     */
    async start({ engineUrl, exampleUrl, controlsUrl }) {
        window.pc = await import(engineUrl);

        // @ts-ignore
        window.top.pc = window.pc;

        files['example.mjs'] = await fetchFile(exampleUrl);
        files['controls.mjs'] = await fetchFile(controlsUrl);

        await this.load();
    }

    async load() {
        this._allowRestart = false;

        // refresh observer instance
        refresh();

        if (!this._started) {
            // just notify to clean UI, but not during hot-reload
            fire('exampleLoading', { showDeviceSelector: !config.NO_DEVICE_SELECTOR });
        }

        if (this._scriptUrl) {
            URL.revokeObjectURL(this._scriptUrl);
        }
        const blob = new Blob([files['example.mjs']], { type: 'text/javascript' });
        this._scriptUrl = URL.createObjectURL(blob);

        try {
            const module = await import(this._scriptUrl);
            this._app = module.app;

            // additional destroy handler in case no app provided
            this._scriptDestroy = module.destroy;
        } catch (e) {
            console.error(e);
            const locations = this._parseErrorLocations(e.stack);
            window.top.dispatchEvent(new CustomEvent('exampleError', {
                detail: {
                    name: e.constructor.name,
                    message: e.message,
                    locations
                }
            }));

            this._allowRestart = true;
            return;
        }

        // set ready state
        this.ready = true;

        if (this._app) {
            if (this._app.frame) {
                this._appStart();
            } else {
                this._app.once('start', () => this._appStart());
            }
        } else {
            this._appStart();
        }
    }

    sendRequestedFiles() {
        fire('requestedFiles', { files });
    }

    /**
     * @param {boolean} enabled - The enabled state of ministats
     */
    setMiniStats(enabled = false) {
        MiniStats.enable(this._app, enabled);
    }

    hotReload() {
        if (!this._allowRestart) {
            console.warn('Dropping restart while still restarting');
            return;
        }
        window.top.dispatchEvent(new CustomEvent('exampleHotReload'));
        this.destroy();
        this.load();
    }

    destroy() {
        MiniStats.destroy();
        if (this._app && this._app.graphicsDevice) {
            this._app.destroy();
        }
        if (this._scriptDestroy) {
            this._scriptDestroy();
            this._scriptDestroy = null;
        }
        this.ready = false;
    }

    exit() {
        if (this._scriptUrl) {
            URL.revokeObjectURL(this._scriptUrl);
        }
        this.destroy();
    }
}

export { ExampleLoader };
