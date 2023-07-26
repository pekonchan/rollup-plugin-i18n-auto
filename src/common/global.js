// 写本地语言配置文件操作的任务控制器
export let writeTaskStash = []
export const pushWriteTaskStash = (value) => {
    writeTaskStash.push(value)
}
export const setWriteTaskStash = (value) => {
    writeTaskStash = value
}
// 写本地语言配置文件操作的定时器
export let wirteTaskTimer = null
export const setWirteTaskTimer = (value) => {
    wirteTaskTimer = value
}
// 是否已创建文件夹
export let outDirCreated = false
export const setOutDirCreated = (value) => {
    outDirCreated = value
}
// 是否正在创建文件夹
export let mkdiring = false
export const setMkdiring = (value) => {
    mkdiring = value
}
// 是否有需要等文件夹创建后执行的写本地配置文件的任务
export let hasDirAfterWriteConfigTask = false
export const setHasDirAfterWriteConfigTask = (value) => {
    hasDirAfterWriteConfigTask = value
}