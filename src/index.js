import i18nTransform from './transform/index.js'
import generateJson from './generate/index.js'
import { createFilter } from '@rollup/pluginutils'
import collectInit from './common/collect.js'

export default function i18nAuto(options = {}) {
    const { setting } = collectInit(options)
    const isBuildMode = setting.mode === 'build'
    return {
        name: 'i18n-auto',
        transform (code, id) {
            const filter = createFilter(setting.include, setting.exclude)
            if (!filter(id)) {
                return { code }
            }
            const newCode = i18nTransform({
                id,
                code
            }, setting)
            isBuildMode || generateJson(setting)
            return {
                code: newCode,
                map: null,
            }
        },
        generateBundle () {
            console.log('Generate i18n file successfully !')
            isBuildMode && generateJson(setting)
        },
    }
};
