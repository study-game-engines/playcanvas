import { Application } from '../../../src/framework/application.js';
import { Asset } from '../../../src/framework/asset/asset.js';
import { JsonHandler } from '../../../src/framework/handlers/json.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock';

import { expect } from 'chai';
import { restore, stub } from 'sinon';

describe('I18n', function () {

    let app;

    beforeEach(function () {
        const canvas = new HTMLCanvasElement(500, 500);
        app = new Application(canvas, { graphicsDevice: new NullGraphicsDevice(canvas) });
    });

    afterEach(function () {
        app.destroy();
        restore();
    });

    const DEFAULT_LOCALE_FALLBACKS = {
        'en': 'en-US',
        'es': 'en-ES',
        'zh': 'zh-CN',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'it': 'it-IT',
        'ru': 'ru-RU',
        'ja': 'ja-JP'
    };

    // Creates data for a single translation as if it was a whole asset
    const createTranslation = function (locale, key, translations) {
        const messages = {};
        messages[key] = translations;
        const data = {
            header: {
                version: 1
            },
            data: [{
                info: {
                    locale: locale
                },
                messages: messages
            }]
        };

        return data;
    };

    // Adds the specified key->translations pair for the specified locale to
    // the specified i18n instance, as if it's adding a whole new asset
    const addText = function (locale, key, translations) {
        const data = createTranslation(locale, key, translations);
        app.i18n.addData(data);
        return data;
    };

    describe('#assets', function () {

        it('returns same ids for assets after setting array of asset ids', function () {
            app.i18n.assets = [1, 2];
            expect(app.i18n.assets).to.deep.equal([1, 2]);
        });

        it('returns same ids for assets after setting array of assets', function () {
            const a1 = new Asset('a1', 'json');
            const a2 = new Asset('a2', 'json');
            app.i18n.assets = [a1, a2];
            expect(app.i18n.assets).to.deep.equal([a1.id, a2.id]);
        });

        it('removes old assets when setting new array', function () {
            app.i18n.assets = [1, 2];
            app.i18n.assets = [2, 3];
            expect(app.i18n.assets).to.deep.equal([2, 3]);
        });

    });

    describe('#findAvailableLocale', function () {

        it('should find locale if translations have been provided for it', function () {
            addText('no-IT', 'key', 'norwegian');
            expect(app.i18n.findAvailableLocale('no-IT')).to.equal('no-IT');
        });

        it('should fallback to en-US if translations have not been provided for the desired locale', function () {
            addText('no-IT', 'key', 'norwegian');
            expect(app.i18n.findAvailableLocale('de-DE')).to.equal('en-US');
        });

        it('should fallback to zh-CN if translations are provided and zh-SG is the desired locale', function () {
            addText('zh-CN', 'key', 'Chinese');
            expect(app.i18n.findAvailableLocale('zh-SG')).to.equal('zh-CN');
        });

        it('should fallback to en-GB if translations are provided and en-US is the desired locale', function () {
            addText('en-GB', 'key', 'British');
            expect(app.i18n.findAvailableLocale('en-US')).to.equal('en-GB');
        });

    });

    describe('#getPluralText', function () {

        it('should return key when no translations exist for that locale', function () {
            expect(app.i18n.getPluralText('key')).to.equal('key');

            addText('no-NO', 'key', ['translated']);
            expect(app.i18n.getPluralText('key')).to.equal('key');
        });

        it('should return key if the desired locale has other translations but not that key', function () {
            addText('no-NO', 'key', ['norwegian']);
            expect(app.i18n.getPluralText('key2', 'no-NO')).to.equal('key2');
            app.i18n.locale = 'no-NO';
            expect(app.i18n.getPluralText('key2')).to.equal('key2');
        });

        it('should return en-US translation if the desired locale has no translations', function () {
            addText('en-US', 'key', ['english one', 'english other']);
            expect(app.i18n.getPluralText('key', 1, 'no-NO')).to.equal('english one');
            app.i18n.locale = 'no-NO';
            expect(app.i18n.getPluralText('key', 1)).to.equal('english one');
        });

        it('should return en-US plural form if the desired locale does not exist', function () {
            addText('en-US', 'key', ['english one', 'english other']);
            expect(app.i18n.getPluralText('key', 1, 'ar')).to.equal('english one');
            app.i18n.locale = 'ar';
            expect(app.i18n.getPluralText('key', 1)).to.equal('english one');
        });

        it('returns empty string if the empty string is a valid translation', function () {
            addText('en-US', 'key', ['', '']);
            expect(app.i18n.getPluralText('key', 0)).to.equal('');
            expect(app.i18n.getPluralText('key', 1)).to.equal('');
            expect(app.i18n.getPluralText('key', 2)).to.equal('');

            ['no-NO', 'ar'].forEach(function (locale) {
                expect(app.i18n.getPluralText('key', 0, locale)).to.equal('');
                expect(app.i18n.getPluralText('key', 1, locale)).to.equal('');
                expect(app.i18n.getPluralText('key', 2, locale)).to.equal('');
                app.i18n.locale = locale;
                expect(app.i18n.getPluralText('key', 0)).to.equal('');
                expect(app.i18n.getPluralText('key', 1)).to.equal('');
                expect(app.i18n.getPluralText('key', 2)).to.equal('');

                addText(locale, 'key', ['', '', '']);

                expect(app.i18n.getPluralText('key', 0)).to.equal('');
                expect(app.i18n.getPluralText('key', 1)).to.equal('');
                expect(app.i18n.getPluralText('key', 2)).to.equal('');
            });
        });

        it('returns key is translation is null', function () {
            addText('en-US', 'key', [null, null]);
            expect(app.i18n.getPluralText('key', 0)).to.equal('key');
            expect(app.i18n.getPluralText('key', 1)).to.equal('key');
            expect(app.i18n.getPluralText('key', 2)).to.equal('key');

            ['no-NO', 'ar'].forEach(function (locale) {
                expect(app.i18n.getPluralText('key', 0, locale)).to.equal('key');
                expect(app.i18n.getPluralText('key', 1, locale)).to.equal('key');
                expect(app.i18n.getPluralText('key', 2, locale)).to.equal('key');
                app.i18n.locale = locale;
                expect(app.i18n.getPluralText('key', 0)).to.equal('key');
                expect(app.i18n.getPluralText('key', 1)).to.equal('key');
                expect(app.i18n.getPluralText('key', 2)).to.equal('key');

                addText(locale, 'key', [null, null, null]);

                expect(app.i18n.getPluralText('key', 0)).to.equal('key');
                expect(app.i18n.getPluralText('key', 1)).to.equal('key');
                expect(app.i18n.getPluralText('key', 2)).to.equal('key');
            });

            addText('es-ES', 'key', null);
            expect(app.i18n.getPluralText('key', 2, 'es-ES')).to.equal('key');
        });

        it('should fall back to default locale for that language if the specific locale does not exist', function () {
            for (const lang in DEFAULT_LOCALE_FALLBACKS) {
                addText(DEFAULT_LOCALE_FALLBACKS[lang], 'key', ['language ' + lang]);
            }
            addText('no-NO', 'key', ['language no']);

            for (const lang in DEFAULT_LOCALE_FALLBACKS) {
                expect(app.i18n.getPluralText('key', 1, lang + '-alt')).to.equal('language ' + lang);
                app.i18n.locale = lang + '-alt';
                expect(app.i18n.getPluralText('key', 1)).to.equal('language ' + lang);
            }

            expect(app.i18n.getPluralText('key', 1, 'no-alt')).to.equal('language no');
            app.i18n.locale = 'no-alt';
            expect(app.i18n.getPluralText('key', 1)).to.equal('language no');

        });

        it('should fall back to default locale for that language if you just pass the language', function () {
            for (const lang in DEFAULT_LOCALE_FALLBACKS) {
                addText(DEFAULT_LOCALE_FALLBACKS[lang], 'key', ['language ' + lang]);
            }
            addText('no-NO', 'key', ['language no']);

            for (const lang in DEFAULT_LOCALE_FALLBACKS) {
                expect(app.i18n.getPluralText('key', 1, lang)).to.equal('language ' + lang);
                app.i18n.locale = lang;
                expect(app.i18n.getPluralText('key', 1)).to.equal('language ' + lang);
            }

            expect(app.i18n.getPluralText('key', 1, 'no')).to.equal('language no');
            app.i18n.locale = 'no';
            expect(app.i18n.getPluralText('key', 1)).to.equal('language no');
        });

        it('should fall back to first available locale for that language if no default fallback exists', function () {
            addText('no-IT', 'key', ['norwegian']);
            expect(app.i18n.getPluralText('key', 1, 'no-NO')).to.equal('norwegian');
            app.i18n.locale = 'no-NO';
            expect(app.i18n.getPluralText('key', 1)).to.equal('norwegian');
        });

        it('should return correct plural forms for \"ja, ko, th, vi, zh\"', function () {
            const locales = ['ja-JP', 'ko-KO', 'th-TH', 'vi-VI', 'zh-ZH'];
            locales.forEach(function (locale) {
                addText(locale, 'key', ['other']);
            });

            locales.forEach(function (locale) {
                expect(app.i18n.getPluralText('key', 0, locale)).to.equal('other');
                expect(app.i18n.getPluralText('key', 1, locale)).to.equal('other');

                app.i18n.locale = locale;
                expect(app.i18n.getPluralText('key', 0)).to.equal('other');
                expect(app.i18n.getPluralText('key', 1)).to.equal('other');
            });
        });

        it('should return correct plural forms for \"fa, hi\"', function () {
            const locales = ['fa-FA', 'hi-HI'];
            locales.forEach(function (locale) {
                addText(locale, 'key', ['one', 'other']);
            });

            const testLocale = function (locale) {
                expect(app.i18n.getPluralText('key', 0, locale)).to.equal('one');
                expect(app.i18n.getPluralText('key', 1, locale)).to.equal('one');
                expect(app.i18n.getPluralText('key', 0.5, locale)).to.equal('one');
                expect(app.i18n.getPluralText('key', -1, locale)).to.equal('other');
                expect(app.i18n.getPluralText('key', 1.1, locale)).to.equal('other');
                expect(app.i18n.getPluralText('key', 2, locale)).to.equal('other');
            };

            locales.forEach(function (locale) {
                testLocale(locale);
                app.i18n.locale = locale;
                testLocale();
            });
        });

        it('should return correct plural forms for \"fr\"', function () {
            const locales = ['fr-FR'];
            locales.forEach(function (locale) {
                addText(locale, 'key', ['one', 'other']);
            });

            const testLocale = function (locale) {
                expect(app.i18n.getPluralText('key', 0, locale)).to.equal('one');
                expect(app.i18n.getPluralText('key', 1, locale)).to.equal('one');
                expect(app.i18n.getPluralText('key', 1.9999, locale)).to.equal('one');
                expect(app.i18n.getPluralText('key', -1, locale)).to.equal('other');
                expect(app.i18n.getPluralText('key', 2, locale)).to.equal('other');
            };

            locales.forEach(function (locale) {
                testLocale(locale);
                app.i18n.locale = locale;
                testLocale();
            });
        });


        it('should return correct plural forms for \"en, de, it, el, es, tr\"', function () {
            const locales = ['en-US', 'en-GB', 'de-DE', 'it-IT', 'el-GR', 'es-ES', 'tr-TR'];
            locales.forEach(function (locale) {
                addText(locale, 'key', ['one', 'other']);
            });

            const testLocale = function (locale) {
                expect(app.i18n.getPluralText('key', 1, locale)).to.equal('one');
                expect(app.i18n.getPluralText('key', 2, locale)).to.equal('other');
                expect(app.i18n.getPluralText('key', 0, locale)).to.equal('other');
                expect(app.i18n.getPluralText('key', 0.5, locale)).to.equal('other');
                expect(app.i18n.getPluralText('key', 1.5, locale)).to.equal('other');
            };

            locales.forEach(function (locale) {
                testLocale(locale);
                app.i18n.locale = locale;
                testLocale();
            });
        });

        it('should return correct plural forms for \"ru, uk\"', function () {
            const locales = ['ru-RU', 'uk-UK'];
            locales.forEach(function (locale) {
                addText(locale, 'key', ['one', 'few', 'many', 'other']);
            });

            const testLocale = function (locale) {
                expect(app.i18n.getPluralText('key', 1, locale)).to.equal('one');
                expect(app.i18n.getPluralText('key', 21, locale)).to.equal('one');
                expect(app.i18n.getPluralText('key', 101, locale)).to.equal('one');
                expect(app.i18n.getPluralText('key', 1001, locale)).to.equal('one');

                expect(app.i18n.getPluralText('key', 2, locale)).to.equal('few');
                expect(app.i18n.getPluralText('key', 3, locale)).to.equal('few');
                expect(app.i18n.getPluralText('key', 22, locale)).to.equal('few');
                expect(app.i18n.getPluralText('key', 24, locale)).to.equal('few');
                expect(app.i18n.getPluralText('key', 1002, locale)).to.equal('few');

                expect(app.i18n.getPluralText('key', 0, locale)).to.equal('many');
                expect(app.i18n.getPluralText('key', 5, locale)).to.equal('many');
                expect(app.i18n.getPluralText('key', 11, locale)).to.equal('many');
                expect(app.i18n.getPluralText('key', 14, locale)).to.equal('many');
                expect(app.i18n.getPluralText('key', 19, locale)).to.equal('many');
                expect(app.i18n.getPluralText('key', 114, locale)).to.equal('many');
                expect(app.i18n.getPluralText('key', 100, locale)).to.equal('many');
                expect(app.i18n.getPluralText('key', 10000, locale)).to.equal('many');

                expect(app.i18n.getPluralText('key', 1.1, locale)).to.equal('other');
                expect(app.i18n.getPluralText('key', 1000.5, locale)).to.equal('other');
            };

            locales.forEach(function (locale) {
                testLocale(locale);
                app.i18n.locale = locale;
                testLocale();

            });
        });

        it('should return correct plural forms for \"ar\"', function () {
            const locales = ['ar-AR'];
            locales.forEach(function (locale) {
                addText(locale, 'key', ['zero', 'one', 'two', 'few', 'many', 'other']);
            });

            const testLocale = function (locale) {
                expect(app.i18n.getPluralText('key', 0, locale)).to.equal('zero');
                expect(app.i18n.getPluralText('key', 1, locale)).to.equal('one');
                expect(app.i18n.getPluralText('key', 2, locale)).to.equal('two');
                expect(app.i18n.getPluralText('key', 3, locale)).to.equal('few');
                expect(app.i18n.getPluralText('key', 10, locale)).to.equal('few');
                expect(app.i18n.getPluralText('key', 103, locale)).to.equal('few');
                expect(app.i18n.getPluralText('key', 110, locale)).to.equal('few');
                expect(app.i18n.getPluralText('key', 11, locale)).to.equal('many');
                expect(app.i18n.getPluralText('key', 26, locale)).to.equal('many');
                expect(app.i18n.getPluralText('key', 111, locale)).to.equal('many');
                expect(app.i18n.getPluralText('key', 1011, locale)).to.equal('many');
                expect(app.i18n.getPluralText('key', 100, locale)).to.equal('other');
                expect(app.i18n.getPluralText('key', 102, locale)).to.equal('other');
                expect(app.i18n.getPluralText('key', 200, locale)).to.equal('other');
                expect(app.i18n.getPluralText('key', 202, locale)).to.equal('other');
                expect(app.i18n.getPluralText('key', 500, locale)).to.equal('other');
                expect(app.i18n.getPluralText('key', 502, locale)).to.equal('other');
                expect(app.i18n.getPluralText('key', 600, locale)).to.equal('other');
                expect(app.i18n.getPluralText('key', 1000, locale)).to.equal('other');
                expect(app.i18n.getPluralText('key', 10000, locale)).to.equal('other');
                expect(app.i18n.getPluralText('key', 0.1, locale)).to.equal('other');
                expect(app.i18n.getPluralText('key', 10.1, locale)).to.equal('other');
            };

            locales.forEach(function (locale) {
                testLocale(locale);
                app.i18n.locale = locale;
                testLocale();

            });
        });

        it('zh-HK should use zh-HK if it exists', function () {
            addText('zh-CN', 'key', ['cn']);
            addText('zh-HK', 'key', ['hk']);
            addText('zh-TW', 'key', ['tw']);
            app.i18n.locale = 'zh-HK';
            expect(app.i18n.getPluralText('key')).to.equal('hk');
        });

        it('zh-HK should fall back to zh-TW', function () {
            addText('zh-CN', 'key', ['cn']);
            addText('zh-TW', 'key', ['hk']);
            app.i18n.locale = 'zh-HK';
            expect(app.i18n.getPluralText('key')).to.equal('hk');
        });

        it('zh-TW should fall back to zh-HK', function () {
            addText('zh-CN', 'key', ['cn']);
            addText('zh-HK', 'key', ['tw']);
            app.i18n.locale = 'zh-TW';
            expect(app.i18n.getPluralText('key')).to.equal('tw');
        });

        it('zh-SG should fall back to zh-CN', function () {
            addText('zh-HK', 'key', ['hk']);
            addText('zh-CN', 'key', ['cn']);
            addText('zh-TW', 'key', ['tw']);
            app.i18n.locale = 'zh-SG';
            expect(app.i18n.getPluralText('key')).to.equal('cn');
        });

    });

    describe('#getText', function () {

        it('should return key when no translations exist for that locale', function () {
            expect(app.i18n.getText('key')).to.equal('key');

            addText('no-NO', 'key', 'translated');
            expect(app.i18n.getText('key')).to.equal('key');
        });

        it('should return localized text when translation exists', function () {
            addText('no-NO', 'key', 'translated');
            expect(app.i18n.getText('key', 'no-NO')).to.equal('translated');
            app.i18n.locale = 'no-NO';
            expect(app.i18n.getText('key')).to.equal('translated');
        });

        it('should return en-US translation if the desired locale has no translations', function () {
            addText('en-US', 'key', 'english');
            expect(app.i18n.getText('key', 'no-NO')).to.equal('english');
            app.i18n.locale = 'no-NO';
            expect(app.i18n.getText('key')).to.equal('english');

            addText('no-NO', 'key', 'norwegian');
            expect(app.i18n.getText('key', 'no-NO')).to.equal('norwegian');
            expect(app.i18n.getText('key')).to.equal('norwegian');
        });

        it('should return key if the desired locale has other translations but not that key', function () {
            addText('no-NO', 'key', 'norwegian');
            expect(app.i18n.getText('key2', 'no-NO')).to.equal('key2');
            app.i18n.locale = 'no-NO';
            expect(app.i18n.getText('key2')).to.equal('key2');
        });

        it('should fall back to default locale for that language if the specific locale does not exist', function () {
            addText('no-NO', 'key', 'norwegian');
            expect(app.i18n.getText('key', 'no-IT')).to.equal('norwegian');
            app.i18n.locale = 'no-IT';
            expect(app.i18n.getText('key')).to.equal('norwegian');
        });

        it('should fall back to default locale for that language if you just pass the language', function () {
            addText('no-NO', 'key', 'norwegian');
            expect(app.i18n.getText('key', 'no')).to.equal('norwegian');
            app.i18n.locale = 'no';
            expect(app.i18n.getText('key')).to.equal('norwegian');
        });

        it('should fall back to first available locale for that language if no default fallback exists', function () {
            addText('no-IT', 'key', 'norwegian');
            expect(app.i18n.getText('key', 'no-NO')).to.equal('norwegian');
            app.i18n.locale = 'no-NO';
            expect(app.i18n.getText('key')).to.equal('norwegian');
        });

        it('when called on plural key should return the first entry', function () {
            addText('no-IT', 'key', ['one', 'other']);
            expect(app.i18n.getText('key', 'no-NO')).to.equal('one');
            app.i18n.locale = 'no-NO';
            expect(app.i18n.getText('key')).to.equal('one');
        });

        it('returns empty string if the empty string is a valid translation', function () {
            addText('en-US', 'key', '');
            expect(app.i18n.getText('key')).to.equal('');
            expect(app.i18n.getText('key', 'no-NO')).to.equal('');
            app.i18n.locale = 'no-NO';
            expect(app.i18n.getText('key')).to.equal('');
        });

        it('returns key if the translation is null', function () {
            addText('en-US', 'key', null);
            expect(app.i18n.getText('key')).to.equal('key');
            expect(app.i18n.getText('key', 'no-NO')).to.equal('key');
            app.i18n.locale = 'no-NO';
            expect(app.i18n.getText('key')).to.equal('key');
        });

        it('zh-HK should use zh-HK if it exists', function () {
            addText('zh-CN', 'key', 'cn');
            addText('zh-HK', 'key', 'hk');
            addText('zh-TW', 'key', 'tw');
            app.i18n.locale = 'zh-HK';
            expect(app.i18n.getText('key')).to.equal('hk');
        });

        it('zh-HK should fall back to zh-TW', function () {
            addText('zh-CN', 'key', 'cn');
            addText('zh-TW', 'key', 'hk');
            app.i18n.locale = 'zh-HK';
            expect(app.i18n.getText('key')).to.equal('hk');
        });

        it('zh-TW should fall back to zh-HK', function () {
            addText('zh-CN', 'key', 'cn');
            addText('zh-HK', 'key', 'tw');
            app.i18n.locale = 'zh-TW';
            expect(app.i18n.getText('key')).to.equal('tw');
        });

        it('zh-SG should fall back to zh-CN', function () {
            addText('zh-HK', 'key', 'hk');
            addText('zh-CN', 'key', 'cn');
            addText('zh-TW', 'key', 'tw');
            app.i18n.locale = 'zh-SG';
            expect(app.i18n.getText('key')).to.equal('cn');
        });

    });

    describe('#locale', function () {

        it('ensures locale for Indonesian always starts with "id"', function () {
            app.i18n.locale = 'id';
            expect(app.i18n.locale).to.equal('id');

            app.i18n.locale = 'id-ID';
            expect(app.i18n.locale).to.equal('id-ID');

            app.i18n.locale = 'in';
            expect(app.i18n.locale).to.equal('id');

            app.i18n.locale = 'in-ID';
            expect(app.i18n.locale).to.equal('id-ID');

            // sanity checks
            app.i18n.locale = 'en';
            expect(app.i18n.locale).to.equal('en');

            app.i18n.locale = 'en-US';
            expect(app.i18n.locale).to.equal('en-US');
        });

    });

    describe('removeData', function () {

        it('removes all data correctly', function () {
            const data1 = addText('en-US', 'key', 'translation');
            const data2 = addText('en-US', 'key2', 'translation2');
            const data3 = addText('no-IT', 'key3', 'translation3');

            expect(app.i18n.getText('key')).to.equal('translation');
            expect(app.i18n.getText('key2')).to.equal('translation2');
            expect(app.i18n.getText('key3', 'no-IT')).to.equal('translation3');
            expect(app.i18n.getText('key3', 'no')).to.equal('translation3');

            app.i18n.removeData(data1);
            expect(app.i18n.getText('key')).to.equal('key');
            expect(app.i18n.getText('key2')).to.equal('translation2');
            expect(app.i18n.getText('key3', 'no-IT')).to.equal('translation3');
            expect(app.i18n.getText('key3', 'no')).to.equal('translation3');

            app.i18n.removeData(data2);
            expect(app.i18n.getText('key2')).to.equal('key2');
            expect(app.i18n.getText('key3', 'no-IT')).to.equal('translation3');
            expect(app.i18n.getText('key3', 'no')).to.equal('translation3');

            app.i18n.removeData(data3);
            expect(app.i18n.getText('key3', 'no-IT')).to.equal('key3');
            expect(app.i18n.getText('key3', 'no')).to.equal('key3');
        });

    });

    it.skip('assets not in asset registry get loaded after they are added to the registry', function (done) {
        stub(JsonHandler.prototype, 'load').callsFake(function (url, callback) {
            callback(null, createTranslation('en-US', 'key', 'translation'));
        });

        const asset = new Asset('a1', 'json', { url: '/fake/url.json' });
        app.i18n.assets = [asset];

        app.i18n.on('data:add', function () {
            expect(app.i18n.getText('key')).to.equal('translation');
            done();
        });

        app.assets.add(asset);
        app.assets.load(asset);
    });

    it.skip('assets in asset registry get loaded when passed to i18n', function (done) {
        stub(JsonHandler.prototype, 'load').callsFake(function (url, callback) {
            callback(null, createTranslation('en-US', 'key', 'translation'));
        });

        const asset = new Asset('a1', 'json', { url: '/fake/url.json' });
        app.assets.add(asset);

        app.i18n.assets = [asset];

        app.i18n.on('data:add', function () {
            expect(app.i18n.getText('key')).to.equal('translation');
            done();
        });

        app.assets.load(asset);
    });

    it('assets already loaded are parsed when passed to i18n', function (done) {
        stub(JsonHandler.prototype, 'load').callsFake(function (url, callback) {
            callback(null, createTranslation('en-US', 'key', 'translation'));
        });

        app.i18n.on('data:add', function () {
            expect(app.i18n.getText('key')).to.equal('translation');
            done();
        });

        const asset = new Asset('a1', 'json', { url: '/fake/url.json' });
        asset.on('load', function () {
            app.i18n.assets = [asset];
        });

        app.assets.add(asset);
        app.assets.load(asset);
    });

    it('translations are unloaded when the asset is unloaded', function (done) {
        stub(JsonHandler.prototype, 'load').callsFake(function (url, callback) {
            callback(null, createTranslation('en-US', 'key', 'translation'));
        });

        const asset = new Asset('a1', 'json', { url: '/fake/url.json' });

        app.i18n.on('data:add', function () {
            asset.unload();
            expect(app.i18n.getText('key')).to.equal('key');
            done();
        });

        asset.on('load', function () {
            app.i18n.assets = [asset];
        });

        app.assets.add(asset);
        app.assets.load(asset);
    });

    it('translations are unloaded when the asset is removed', function (done) {
        stub(JsonHandler.prototype, 'load').callsFake(function (url, callback) {
            callback(null, createTranslation('en-US', 'key', 'translation'));
        });

        const asset = new Asset('a1', 'json', { url: '/fake/url.json' });

        app.i18n.on('data:add', function () {
            app.assets.remove(asset);
            expect(app.i18n.getText('key')).to.equal('key');
            done();
        });

        asset.on('load', function () {
            app.i18n.assets = [asset];
        });

        app.assets.add(asset);
        app.assets.load(asset);
    });

    it('translations are re-loaded when the asset is removed and then added again', function (done) {
        stub(JsonHandler.prototype, 'load').callsFake(function (url, callback) {
            callback(null, createTranslation('en-US', 'key', 'translation'));
        });

        const asset = new Asset('a1', 'json', { url: '/fake/url.json' });

        app.i18n.once('data:add', function () {
            app.assets.remove(asset);

            setTimeout(function () {
                app.assets.add(asset);
                expect(app.i18n.getText('key')).to.equal('translation');
                done();
            });
        });

        asset.once('load', function () {
            app.i18n.assets = [asset];
        });

        app.assets.add(asset);
        app.assets.load(asset);
    });

    it('translations are re-loaded when the contents of the asset change', function (done) {
        stub(JsonHandler.prototype, 'load').callsFake(function (url, callback) {
            callback(null, createTranslation('en-US', 'key', 'translation'));
        });

        const asset = new Asset('a1', 'json', { url: '/fake/url.json' });

        app.i18n.once('data:add', function () {
            expect(app.i18n.getText('key')).to.equal('translation');

            setTimeout(function () {
                app.i18n.once('data:add', function () {
                    expect(app.i18n.getText('key')).to.equal('changed');
                    done();
                });

                asset.resource = createTranslation('en-US', 'key', 'changed');
            });
        });

        asset.once('load', function () {
            app.i18n.assets = [asset];
        });

        app.assets.add(asset);
        app.assets.load(asset);
    });

});
