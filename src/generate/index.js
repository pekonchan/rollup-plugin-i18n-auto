import {
    updateResourceMap,
    createConfigbyMap,
} from '../common/collect.js'
import createTranslate from '../translate/index.js';
import createResouceMap from './resourceMap.js'
import createLocaleWordConfig from './wordConfig.js'

let translating = false

/**
 * create i18n language config files
 */
const handleTranslate = async (translation) => {
    const localeConfigOrigin = createConfigbyMap()
    const localeConfig = {}
    for (const key in localeConfigOrigin) {
        localeConfig[key] = localeConfigOrigin[key].value
    }
    translating = true
    try {
        await createTranslate(translation, {text: localeConfig})
    } catch (e) {
        console.error(e)
    }
    translating = false
}

const generateJson = (options) => {
    const {
        output,
        sourceMap,
        translate,
    } = options
    
    const { configNeedUpdate, sourceMapNeedUpdate } = updateResourceMap()

    if (configNeedUpdate) {
        createLocaleWordConfig(output)
    }

    if (!translating && translate.on) {
        handleTranslate(translate)
    }
    
    if (sourceMap.on && sourceMapNeedUpdate) {
        createResouceMap(sourceMap)
    }

}

export default generateJson;
