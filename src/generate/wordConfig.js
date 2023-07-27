import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { createConfigbyMap, updateConfig } from '../common/collect.js';

let dirCreated = false
let mkdiring = false
let hasDirAfterWriteTask = false
let wirteTaskTimer = null
let writeTaskStash = []

function generate ({path: dir, filename}) {
    const localeWordConfig = createConfigbyMap()
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
    writeTaskStash = []
    const controller = new AbortController()
    const { signal } = controller
    writeTaskStash.push(controller)
    writeFile(path.resolve(dir, filename), content, { signal })
}

// 防抖
// 对生成配置文件的写操作进行防抖
function debounceWrite (output) {
    if (wirteTaskTimer) {
        clearTimeout(wirteTaskTimer)
    }
    const timer = setTimeout(() => {
        generate(output)
        wirteTaskTimer = null
    }, 300)
    wirteTaskTimer = timer
}

export default async function (output) {
    if (!dirCreated) {
        if (mkdiring) {
            hasDirAfterWriteTask = true
        }
        try {
            mkdiring = true
            await mkdir(output.path, { recursive: true })
            dirCreated = true
            // 创建文件夹过程中有需要创建本地配置文件的情况，在创建时被中断了，所以在创建结束后再执行一次
            hasDirAfterWriteTask && debounceWrite(output)
        } catch (err) {
            console.error('🚀 ~ file: wordConfig.js:59 ~ err:', err)
        }
        mkdiring = false
    }
    
    debounceWrite(output)
}