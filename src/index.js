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
            console.log('🚀 ~ file: index.js:9 ~ transform ~ id:', id);
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
        // closeWatcher () {
        //     console.log('🚀 ~ file: index.js:25 ~ closeWatcher ~ closeWatcher:');
        // },
        // moduleParsed () {
        //     console.log('🚀 ~ file: index.js:25 ~ moduleParsed ~ moduleParsed:');
        // },
        // onLog () {
        //     console.log('🚀 ~ file: index.js:25 ~ onLog ~ onLog:');
        // },
        // options () {
        //     console.log('🚀 ~ file: index.js:25 ~ options ~ options:');
        // },
        // watchChange () {
        //     console.log('🚀 ~ file: index.js:25 ~ watchChange ~ watchChange:');
        // },
        // augmentChunkHash () {
        //     console.log('🚀 ~ file: index.js:25 ~ augmentChunkHash ~ augmentChunkHash:');
        // },
        // banner () {
        //     console.log('🚀 ~ file: index.js:25 ~ banner ~ banner:');
        // },
        // closeBundle () {
        //     console.log('🚀 ~ file: index.js:25 ~ closeBundle ~ closeBundle:');
        // },
        // footer () {
        //     console.log('🚀 ~ file: index.js:25 ~ footer ~ footer:');
        // },
        // intro () {
        //     console.log('🚀 ~ file: index.js:25 ~ intro ~ intro:');
        // },
        // renderChunk () {
        //     console.log('🚀 ~ file: index.js:25 ~ renderChunk ~ renderChunk:');
        // },
        // outro () {
        //     console.log('🚀 ~ file: index.js:25 ~ outro ~ outro:');
        // },
        // renderStart () {
        //     console.log('🚀 ~ file: index.js:25 ~ renderStart ~ renderStart:');
        // },
        buildEnd (error) {
            console.log('🚀 ~ file: index.js:64 ~ buildEnd ~ error:', error);
        },
        generateBundle () {
            console.log('🚀 ~ file: index.js:32 ~ generateBundle ~ generateBundle:');
            isBuildMode && generateJson(setting)
        },
        // outputOptions () {
        //     console.log('🚀 ~ file: index.js:35 ~ outputOptions ~ outputOptions:');
        // },
        // writeBundle () {
        //     console.log('🚀 ~ file: index.js:38 ~ writeBundle ~ writeBundle:');
        // },
        // resolveFileUrl () {
        //     console.log('🚀 ~ file: index.js:25 ~ resolveFileUrl ~ resolveFileUrl:');
        // },
        // resolveImportMeta () {
        //     console.log('🚀 ~ file: index.js:25 ~ resolveImportMeta ~ resolveImportMeta:');
        // }
    }
};
