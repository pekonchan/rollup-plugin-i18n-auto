import i18nTransform from './transform/index.js';
import generateJson from './generate/index.js';

export default function i18nAuto(options = {}) {
    return {
        name: 'i18n-auto',
        transform (code, id) {
            const href = id.split('?')[0]
            const extendIndex = href.lastIndexOf('.')
            const extendName = href.slice(extendIndex + 1)
            if (['js'].indexOf(extendName) === -1) {
                return
            }
            // let ast = this.parse(code);
            const newCode = i18nTransform({
                id,
                code
            }, options);
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
