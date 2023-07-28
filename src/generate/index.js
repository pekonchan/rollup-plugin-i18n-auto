import {
    updateResourceMap,
    createConfigbyMap,
} from '../common/collect.js'
import createTranslate from '../translate/index.js';
import createResouceMap from './resourceMap.js'
import createLocaleWordConfig from './wordConfig.js'

/**
 * create i18n language config files
 */
const handleTranslate = async (translation) => {
    const localeConfigOrigin = createConfigbyMap()
    const localeConfig = {}
    for (const key in localeConfigOrigin) {
        localeConfig[key] = localeConfigOrigin[key].value
    }
    try {
        await createTranslate(translation, {text: localeConfig})
    } catch (e) {
        console.error(e)
    }
}

export default function (setting) {
    const { output, translate, mode, sourceMap } = setting
    const { configNeedUpdate, sourceMapNeedUpdate } = updateResourceMap()

    if (mode === 'build' && translate.on) {
        handleTranslate(translate)
    }
    if (output.generate && configNeedUpdate) {
        createLocaleWordConfig(output)
    }
    if (sourceMap.on && sourceMapNeedUpdate) {
        createResouceMap(sourceMap)
    }
}
