import i18nTransform from './transform/index.js'
import generateJson from './generate/index.js'
import { createFilter } from '@rollup/pluginutils'

export default function i18nAuto(options = {}) {
    return {
        name: 'i18n-auto',
        transform (code, id) {
            const filter = createFilter(options.include, options.exclude)
            if (!filter(id)) {
                return { code }
            }
            // let ast = this.parse(code);
            const newCode = i18nTransform({
                id,
                code
            }, options)
            generateJson(options)
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
