import {
    globalSetting,
    getResource,
    setCompileDone,
    setCompiledFiles,
    updateResourceMap,
    createConfigbyMap,
    updateConfig,
} from '../common/collect.js';
const {
    translate: globalSettingTranslate
} = globalSetting
import { createFile } from '../common/utils.js';
import createTranslate from '../translate/index.js';
import path from 'node:path';

let once = false
let translating = false

/**
 * Create locale language config
 * @param {Object} output
 */
const createConfig = (output) => {
    const localeWordConfig = createConfigbyMap()
    console.log('🚀 ~ file: index.js:26 ~ createConfig ~ localeWordConfig:', localeWordConfig);
    const { path, filename } = output || globalSetting.output
    let content = {}
    for (const key in localeWordConfig) {
        if (Object.prototype.hasOwnProperty.call(localeWordConfig, key)) {
            content[key] = localeWordConfig[key].value || ''
        }
    }
    updateConfig(content)
    content = JSON.stringify(content)
    createFile({content, path, filename})
}

/**
 * Create the language config sourcemap
 * @param {Object} param0 
 */
const createSourceMap = ({path, filename}) => {
    let mapSource = getResource()
    mapSource = JSON.stringify(mapSource)
    createFile({content: mapSource, path, filename})
}

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

const initOption = (options) => {
    const {
        output,
        watch,
        sourceMap,
        translate,
    } = options || {}

    let watchConfig = {
        on: false,
    }
    if (typeof watch === 'boolean') {
        watchConfig.on = watch
    } else if (watch) {
        const { on } = watch
        watchConfig.on = !!on
    }

    let sourceMapConfig = {
        on: false,
        path: path.resolve(process.cwd(), './lang'),
        filename: 'zh.sourcemap.json'
    }
    if (typeof sourceMap === 'boolean') {
        sourceMapConfig.on = sourceMap
    } else if (sourceMap) {
        const { on, path, filename } = sourceMap
        sourceMapConfig.on = !!on
        path && (sourceMapConfig.path = path)
        filename && (sourceMapConfig.filename = filename)
    }

    let translateConfig = {}
    if (typeof translate === 'boolean') {
        translateConfig.on = translate
    } else if (translate) {
        for (const setting in translate) {
            translateConfig[setting] = translate[setting]
        }
    }

    return {
        output,
        watch: watchConfig,
        sourceMap: sourceMapConfig,
        translate: translateConfig,
    }
};

/**
 * The plugin emit job
 * @param {Object} output
 * @param {Object} sourceMap
 * @param {Boolean} fileChange - Wether the file should update
 */
const createEmit = ({output, sourceMap, translate}, fileChange) => {
    const {
        configNeedUpdate,
        sourceMapNeedUpdate,
    } = fileChange
    console.log('🚀 ~ file: index.js:126 ~ createEmit ~ configNeedUpdate:', configNeedUpdate);
    if (configNeedUpdate) {
        createConfig(output)
    }

    if (!translating) {
        if (translate.on != null) {
            translate.on && handleTranslate(translate)
        } else if (globalSettingTranslate.on) {
            handleTranslate(translate)
        }
    }
    
    if (sourceMap.on && sourceMapNeedUpdate) {
        createSourceMap({
            path: sourceMap.path,
            filename: sourceMap.filename
        })
    }
}

const generateJson = (options) => {
    const {
        output,
        watch,
        sourceMap,
        translate,
    } = initOption(options);

    const handleData = () => {
        const fileChange = updateResourceMap()
        setCompiledFiles([])
        setCompileDone(true)
        createEmit({
            output,
            sourceMap,
            translate
        }, fileChange)
    }

    if (!once) {
        handleData()
        once = true
    } else if (watch.on) {
        handleData()
    }
}

export default generateJson;
