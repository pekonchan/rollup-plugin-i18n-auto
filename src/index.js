import i18nTransform from './transform/index.js'
import generateJson from './generate/index.js'
import { createFilter } from '@rollup/pluginutils'
import collectInit from './common/collect.js'

export default function i18nAuto(options = {}) {
    const { setting } = collectInit(options)
    return {
        name: 'i18n-auto',
        transform (code, id) {
            const filter = createFilter(setting.include, setting.exclude)
            if (!filter(id)) {
                return { code }
            }
            console.log('🚀 ~ file: index.js:9 ~ transform ~ id:', id);
            const newCode = i18nTransform({
                id,
                code
            }, setting)
            generateJson(setting)
            return {
                code: newCode,
                map: null,
            }
        },
        buildEnd (error) {
            console.log('🚀 ~ file: index.js:25 ~ buildEnd ~ error:', error);
            if (error) {
                return;
            }
            generateJson();
        }
    }
};
