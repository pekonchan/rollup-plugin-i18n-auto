const rootPath = process.cwd()
import path from 'node:path'
import { readFileSync } from 'node:fs'

export let globalSetting = {}
let localeWordConfig = {}
let lastLocaleWordConfig = {}
const resourceMap = {}
let currentCompileResourceMap = {}

/**
 * Init setting
 * @param {Object} setting 
 */
function initSetting (setting) {
    const defaultFile = {
        filename: 'zh.json',
        path: path.resolve(rootPath, './lang')
    }
    const defaultSetting = {
        mode: 'build',
        output: {
            generate: true,
            ...defaultFile
        },
        localePattern: /[\u4e00-\u9fa5]/, // chinese
        keyRule: null,
        include: undefined,
        exclude: undefined,
        i18nCallee: '',
        dependency: undefined,
        alias: [],
        sourceMap: false,
        transform: true,
        translate: false,
    }

    for (const key in defaultSetting) {
        if (setting[key] === undefined) {
            continue
        }
        const value = defaultSetting[key]
        if (value && value.constructor === Object) {
            Object.assign(defaultSetting[key], setting[key])
        } else {
            defaultSetting[key] = setting[key]
        }
    }

    const { sourceMap, translate } = setting
    // resourcemap setting
    let defaultSourceMapConfig = {
        on: false,
        path: path.resolve(rootPath, './lang'),
        filename: 'zh.sourcemap.json'
    }
    if (typeof sourceMap === 'boolean') {
        defaultSourceMapConfig.on = sourceMap
    } else if (sourceMap) {
        const { on, path, filename } = sourceMap
        defaultSourceMapConfig.on = !!on
        path && (defaultSourceMapConfig.path = path)
        filename && (defaultSourceMapConfig.filename = filename)
    }
    defaultSetting.sourceMap = defaultSourceMapConfig

    // translate setting
    let defaultTranslateConfig = {
        on: false,
        lang: ['en'],
        path: defaultFile.path,
        nameRule (lang) {
            return `${lang}.json`
        },
        startTotal: 0,
        endTotal: 5000000,
        secretId: '', // If translate on, secretId is required
        secretKey: '', // If translate on, secretKey is required
        region: 'ap-beijing',
        endpoint: 'tmt.tencentcloudapi.com',
        source: 'zh',
        projectId: 0
    }
    if (typeof translate === 'boolean') {
        defaultTranslateConfig.on = translate
    } else if (translate) {
        for (const setting in translate) {
            defaultTranslateConfig[setting] = translate[setting]
        }
    }
    defaultSetting.translate = defaultTranslateConfig
    // 如果设置开启翻译，且 没指定生成翻译文件的地址，则保持跟output的地址一致
    if (defaultSetting.translate.on && !setting.translate.path) {
        defaultSetting.translate.path = defaultSetting.output.path
    }

    globalSetting = defaultSetting
}

/**
 * Init locale word config
 * @returns 
 */
function initWordConfig () {
    const {path: outputPath, filename} = globalSetting.output
    const outputFile = path.resolve(outputPath, filename)
    try {
        let exsitConfig = readFileSync(outputFile, { encoding: 'utf8' })
        exsitConfig = JSON.parse(exsitConfig)
        for (const key in exsitConfig) {
            if (!Object.prototype.hasOwnProperty.call(exsitConfig, key)) {
                return
            }
            localeWordConfig[key] = exsitConfig[key]
            lastLocaleWordConfig[key] = exsitConfig[key]
        }
    } catch (e) {
        console.error('There is no locale keyword file ' + outputFile)
    }
}

/**
 * Initialize
 */
export default function init (options) {
    initSetting(options)
    initWordConfig()

    return {
        localeWordConfig,
        setting: globalSetting,
    }
}

const addConfig = (key, value) => {
    if (localeWordConfig[key]) {
        return addConfig(++key, value)
    } else {
        localeWordConfig[key] = value
        return key + ''
    }
}

/**
 * Default rule to set the key for new word
 * @returns 
 */
const defaultKeyRule = (value) => {
    const max = (Object.keys(localeWordConfig).sort((a,b) => b-a))[0]
    let key = ''
    let isAdded = false
    for (let i = 0; i < max; i++) {
        if (!localeWordConfig[i]) {
            localeWordConfig[i] = value
            isAdded = true
            key = (i + '')
            break
        }
    }
    if (isAdded) {
        return key
    } else {
        const len = Object.keys(localeWordConfig).length
        return addConfig(len, value)
    }
}

export const setConfig = (value) => {
    let currentKey = getKey(value)
    if (currentKey) {
        return currentKey
    } else {
        if (globalSetting.keyRule) {
            const newKey = globalSetting.keyRule(value, localeWordConfig)
            localeWordConfig[newKey] = value
            return newKey
        } else {
            return defaultKeyRule(value)
        }
    }
}

export const updateConfig = (value) => {
    localeWordConfig = JSON.parse(JSON.stringify(value))
    lastLocaleWordConfig = JSON.parse(JSON.stringify(value))
}

export const getKey = (value) => {
    let currentKey = null
    for (const k in localeWordConfig) {
        if (!Object.prototype.hasOwnProperty.call(localeWordConfig, k)) {
            return
        }
        if (localeWordConfig[k] === value) {
            currentKey = k
            break
        }
    }
    return currentKey
}

export const setCurrentCompileResourceMap = (file, collection, keyInCodes) => {
    let config = {}
    if (keyInCodes.length) {
        keyInCodes.forEach(key => {
            if (!localeWordConfig[key]) {
                return
            }
            if (!config[key]) {
                config[key] = {
                    value: localeWordConfig[key],
                    count: 1
                }
            } else {
                config[key].count++
            }
        })
    } else if (collection.length === 0 && !resourceMap[file]) {
        return
    }
    
    collection.forEach(item => {
        const key = Object.keys(item)[0]
        const val = item[key]
        if (!config[key]) {
            config[key] = {
                value: val,
                count: 1
            }
        } else if (config[key].value === val) {
            config[key].count++
        }
    })

    currentCompileResourceMap[file] = config
}

export const updateResourceMap = () => {
    let configNeedUpdate = false
    let sourceMapNeedUpdate = false
    
    // Handle resouce map
    for (const file in currentCompileResourceMap) {
        const newPathtMap = currentCompileResourceMap[file]
        const lastPathMap = resourceMap[file]

        // Determine whether the resource map file needs to be updated
        if (!configNeedUpdate) {
            const newKeys = Object.keys(newPathtMap)
            const oldKeys = lastPathMap ? Object.keys(lastPathMap) : []
            if ((newKeys.length !== oldKeys.length) || (oldKeys.join('+') !== newKeys.join('+'))) {
                sourceMapNeedUpdate = true
                // When the file delete the word after the file has been transformed (Not first transform)
                lastPathMap && (configNeedUpdate = true)
            } else {
                for (const key in newPathtMap) {
                    if (newPathtMap[key].count !== lastPathMap[key].count) {
                        sourceMapNeedUpdate = true
                        break
                    }
                }
            }
        }

        // Update resouceMap
        if (JSON.stringify(newPathtMap) === '{}') {
            if (lastPathMap) {
                delete resourceMap[file]
            }
        } else {
            resourceMap[file] = newPathtMap
        }
    }
    currentCompileResourceMap = {}
    
    // Handle config
    if (!configNeedUpdate) {
        const newConfig = createConfigbyMap()
        for (const key in newConfig) {
            if (newConfig[key].value !== lastLocaleWordConfig[key]) {
                configNeedUpdate = true
                break
            }
        }
    }
    

    return {
        configNeedUpdate,
        sourceMapNeedUpdate,
    }
}

export const getResource = (path) => {
    if (path) {
        const pathConfig = resourceMap[path]
        if (pathConfig) {
            return JSON.parse(JSON.stringify(pathConfig))
        } else {
            return {}
        }
    } else {
        return JSON.parse(JSON.stringify(resourceMap))
    }
}

export const createConfigbyMap = () => {
    let config = {}
    for (const path in resourceMap) {
        for (const key in resourceMap[path]) {
            const thisMap = resourceMap[path]
            if (!config[key]) {
                config[key] = JSON.parse(JSON.stringify(thisMap[key]))
            } else if (config[key].value === thisMap[key].value) {
                config[key].count += thisMap[key].count
            }
        }
    }
    return config
}
