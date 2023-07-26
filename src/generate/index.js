import {
    globalSetting,
    getResource,
    updateResourceMap,
    createConfigbyMap,
    updateConfig,
} from '../common/collect.js';
const {
    translate: globalSettingTranslate
} = globalSetting
import { createFileWidthPath } from '../common/utils.js';
import createTranslate from '../translate/index.js';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { cwd } from 'node:process';
import {
    outDirCreated,
    setOutDirCreated,
    wirteTaskTimer,
    setWirteTaskTimer,
    mkdiring,
    setMkdiring,
    writeTaskStash,
    pushWriteTaskStash,
    setWriteTaskStash,
    hasDirAfterWriteConfigTask,
    setHasDirAfterWriteConfigTask,
} from '../common/global.js'

let translating = false

/**
 * Create locale language config
 * @param {Object} output
 */
const createConfig = async (output) => {
    const localeWordConfig = createConfigbyMap()
    const { path: dir, filename } = output || globalSetting.output
    let content = {}
    for (const key in localeWordConfig) {
        if (Object.prototype.hasOwnProperty.call(localeWordConfig, key)) {
            content[key] = localeWordConfig[key].value || ''
        }
    }
    updateConfig(content)
    content = JSON.stringify(content)

    // 把正在写配置的操作中断了，使用最新的写操作
    writeTaskStash.forEach(ctrl => {
        ctrl.abort()
    })
    setWriteTaskStash([])
    const controller = new AbortController()
    const { signal } = controller
    pushWriteTaskStash(controller)
    writeFile(path.resolve(cwd(), dir, filename), content, { signal })
}

/**
 * Create the language config sourcemap
 * @param {Object} param0 
 */
const createSourceMap = ({path, filename}) => {
    let mapSource = getResource()
    mapSource = JSON.stringify(mapSource)
    createFileWidthPath({content: mapSource, path, filename})
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
        sourceMap,
        translate,
    } = options || {}

    // let watchConfig = {
    //     on: false,
    // }
    // if (typeof watch === 'boolean') {
    //     watchConfig.on = watch
    // } else if (watch) {
    //     const { on } = watch
    //     watchConfig.on = !!on
    // }

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
const createEmit = async ({output, sourceMap, translate}, fileChange) => {
    const {
        configNeedUpdate,
        sourceMapNeedUpdate,
    } = fileChange
    if (configNeedUpdate) {
        // 防抖
        // 对生成配置文件的写操作进行防抖
        const debounceWrite = () => {
            if (wirteTaskTimer) {
                clearTimeout(wirteTaskTimer)
            }
            const timer = setTimeout(() => {
                createConfig(output)
                setWirteTaskTimer(null)
            }, 300)
            setWirteTaskTimer(timer)
        }

        if (!outDirCreated) {
            if (mkdiring) {
                setHasDirAfterWriteConfigTask(true)
            }
            try {
                setMkdiring(true)
                const { path } = output || globalSetting.output
                await mkdir(path, { recursive: true })
                setOutDirCreated(true)
                // 创建文件夹过程中有需要创建本地配置文件的情况，在创建时被中断了，所以在创建结束后再执行一次
                hasDirAfterWriteConfigTask && debounceWrite()
            } catch (err) {
                console.error('🚀 ~ file: index.js:143 ~ createEmit ~ err:', err.message);
            }
            setMkdiring(false)
        }
        
        debounceWrite()
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
        sourceMap,
        translate,
    } = initOption(options);
    
    const fileChange = updateResourceMap()
    createEmit({
        output,
        sourceMap,
        translate
    }, fileChange)
}

export default generateJson;
