'use strict';

var parser = require('@babel/parser');
var traverse = require('@babel/traverse');
var generator = require('@babel/generator');
var types = require('@babel/types');
var path = require('node:path');
var fs = require('node:fs');
var tencentcloud = require('tencentcloud-sdk-nodejs-tmt');
var promises = require('node:fs/promises');
var pluginutils = require('@rollup/pluginutils');

const rootPath = process.cwd();

let globalSetting = {};
let localeWordConfig = {};
let lastLocaleWordConfig = {};
const resourceMap = {};
let currentCompileResourceMap = {};

/**
 * Init setting
 * @param {Object} setting 
 */
function initSetting (setting) {
    const defaultFile = {
        filename: 'zh.json',
        path: path.resolve(rootPath, './lang')
    };
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
    };

    for (const key in defaultSetting) {
        if (setting[key] === undefined) {
            continue
        }
        const value = defaultSetting[key];
        if (value && value.constructor === Object) {
            Object.assign(defaultSetting[key], setting[key]);
        } else {
            defaultSetting[key] = setting[key];
        }
    }

    const { sourceMap, translate } = setting;
    // resourcemap setting
    let defaultSourceMapConfig = {
        on: false,
        path: path.resolve(rootPath, './lang'),
        filename: 'zh.sourcemap.json'
    };
    if (typeof sourceMap === 'boolean') {
        defaultSourceMapConfig.on = sourceMap;
    } else if (sourceMap) {
        const { on, path, filename } = sourceMap;
        defaultSourceMapConfig.on = !!on;
        path && (defaultSourceMapConfig.path = path);
        filename && (defaultSourceMapConfig.filename = filename);
    }
    defaultSetting.sourceMap = defaultSourceMapConfig;

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
    };
    if (typeof translate === 'boolean') {
        defaultTranslateConfig.on = translate;
    } else if (translate) {
        for (const setting in translate) {
            defaultTranslateConfig[setting] = translate[setting];
        }
    }
    defaultSetting.translate = defaultTranslateConfig;
    // 如果设置开启翻译，且 没指定生成翻译文件的地址，则保持跟output的地址一致
    if (defaultSetting.translate.on && !setting.translate.path) {
        defaultSetting.translate.path = defaultSetting.output.path;
    }

    globalSetting = defaultSetting;
}

/**
 * Init locale word config
 * @returns 
 */
function initWordConfig () {
    const {path: outputPath, filename} = globalSetting.output;
    const outputFile = path.resolve(outputPath, filename);
    try {
        let exsitConfig = fs.readFileSync(outputFile, { encoding: 'utf8' });
        exsitConfig = JSON.parse(exsitConfig);
        for (const key in exsitConfig) {
            if (!Object.prototype.hasOwnProperty.call(exsitConfig, key)) {
                return
            }
            localeWordConfig[key] = exsitConfig[key];
            lastLocaleWordConfig[key] = exsitConfig[key];
        }
    } catch (e) {
        console.error('There is no locale keyword file ' + outputFile);
    }
}

/**
 * Initialize
 */
function init (options) {
    initSetting(options);
    initWordConfig();

    return {
        localeWordConfig,
        setting: globalSetting,
    }
}

const addConfig = (key, value) => {
    if (localeWordConfig[key]) {
        return addConfig(++key, value)
    } else {
        localeWordConfig[key] = value;
        return key + ''
    }
};

/**
 * Default rule to set the key for new word
 * @returns 
 */
const defaultKeyRule = (value) => {
    const max = (Object.keys(localeWordConfig).sort((a,b) => b-a))[0];
    let key = '';
    let isAdded = false;
    for (let i = 0; i < max; i++) {
        if (!localeWordConfig[i]) {
            localeWordConfig[i] = value;
            isAdded = true;
            key = (i + '');
            break
        }
    }
    if (isAdded) {
        return key
    } else {
        const len = Object.keys(localeWordConfig).length;
        return addConfig(len, value)
    }
};

const setConfig = (value) => {
    let currentKey = getKey(value);
    if (currentKey) {
        return currentKey
    } else {
        if (globalSetting.keyRule) {
            const newKey = globalSetting.keyRule(value, localeWordConfig);
            localeWordConfig[newKey] = value;
            return newKey
        } else {
            return defaultKeyRule(value)
        }
    }
};

const updateConfig = (value) => {
    localeWordConfig = JSON.parse(JSON.stringify(value));
    lastLocaleWordConfig = JSON.parse(JSON.stringify(value));
};

const getKey = (value) => {
    let currentKey = null;
    for (const k in localeWordConfig) {
        if (!Object.prototype.hasOwnProperty.call(localeWordConfig, k)) {
            return
        }
        if (localeWordConfig[k] === value) {
            currentKey = k;
            break
        }
    }
    return currentKey
};

const setCurrentCompileResourceMap = (file, collection, keyInCodes) => {
    let config = {};
    if (keyInCodes.length) {
        keyInCodes.forEach(key => {
            if (!localeWordConfig[key]) {
                return
            }
            if (!config[key]) {
                config[key] = {
                    value: localeWordConfig[key],
                    count: 1
                };
            } else {
                config[key].count++;
            }
        });
    } else if (collection.length === 0 && !resourceMap[file]) {
        return
    }
    
    collection.forEach(item => {
        const key = Object.keys(item)[0];
        const val = item[key];
        if (!config[key]) {
            config[key] = {
                value: val,
                count: 1
            };
        } else if (config[key].value === val) {
            config[key].count++;
        }
    });

    currentCompileResourceMap[file] = config;
};

const updateResourceMap = () => {
    let configNeedUpdate = false;
    let sourceMapNeedUpdate = false;
    
    // Handle resouce map
    for (const file in currentCompileResourceMap) {
        const newPathtMap = currentCompileResourceMap[file];
        const lastPathMap = resourceMap[file];

        // Determine whether the resource map file needs to be updated
        if (!configNeedUpdate) {
            const newKeys = Object.keys(newPathtMap);
            const oldKeys = lastPathMap ? Object.keys(lastPathMap) : [];
            if ((newKeys.length !== oldKeys.length) || (oldKeys.join('+') !== newKeys.join('+'))) {
                sourceMapNeedUpdate = true;
                // When the file delete the word after the file has been transformed (Not first transform)
                lastPathMap && (configNeedUpdate = true);
            } else {
                for (const key in newPathtMap) {
                    if (newPathtMap[key].count !== lastPathMap[key].count) {
                        sourceMapNeedUpdate = true;
                        break
                    }
                }
            }
        }

        // Update resouceMap
        if (JSON.stringify(newPathtMap) === '{}') {
            if (lastPathMap) {
                delete resourceMap[file];
            }
        } else {
            resourceMap[file] = newPathtMap;
        }
    }
    currentCompileResourceMap = {};
    
    // Handle config
    if (!configNeedUpdate) {
        const newConfig = createConfigbyMap();
        if (Object.keys(newConfig).length !== Object.keys(lastLocaleWordConfig).length) {
            configNeedUpdate = true;
        } else {
            for (const key in newConfig) {
                if (newConfig[key].value !== lastLocaleWordConfig[key]) {
                    configNeedUpdate = true;
                    break
                }
            }
        }
    }
    

    return {
        configNeedUpdate,
        sourceMapNeedUpdate,
    }
};

const getResource = (path) => {
    if (path) {
        const pathConfig = resourceMap[path];
        if (pathConfig) {
            return JSON.parse(JSON.stringify(pathConfig))
        } else {
            return {}
        }
    } else {
        return JSON.parse(JSON.stringify(resourceMap))
    }
};

const createConfigbyMap = () => {
    let config = {};
    for (const path in resourceMap) {
        for (const key in resourceMap[path]) {
            const thisMap = resourceMap[path];
            if (!config[key]) {
                config[key] = JSON.parse(JSON.stringify(thisMap[key]));
            } else if (config[key].value === thisMap[key].value) {
                config[key].count += thisMap[key].count;
            }
        }
    }
    return config
};

// const localeWordPattern = /(\S.*)*[\u4e00-\u9fa5]+(.*\S)*/g

const localeWordPattern = (word) => {
    const pattern = globalSetting.localePattern;
    if (!pattern.test(word)) {
        return null
    }
    const matches = [];
    const wordByLines = word.split('\n');
    wordByLines.forEach(wordLine => {
        if (!pattern.test(wordLine)) {
            return
        }
        const firstCharNotSpace = wordLine.match(/\S/);
        const lastSpace = wordLine.match(/\s+$/);
        const firstCharNotSpaceIndex = firstCharNotSpace.index;
        let wordMatchPart = '';
        if (lastSpace) {
            wordMatchPart = wordLine.substring(firstCharNotSpaceIndex, lastSpace.index);
        } else {
            wordMatchPart = wordLine.substring(firstCharNotSpaceIndex);
        }
        matches.push(wordMatchPart);
    });

    return matches
};

const createSplitNode = ({word, wordKeyMap, calle}) => {
    if (!globalSetting.localePattern.test(word)) {
        return [types.stringLiteral(word)]
    }
    const result = [];
    const firstCharNotSpace = word.match(/\S/);
    const lastSpace = word.match(/\s+$/);
    const firstCharNotSpaceIndex = firstCharNotSpace.index;
    let leftPart = '';
    let wordMatchPart = '';
    let rightPart = '';
    if (firstCharNotSpaceIndex !== 0) {
        leftPart = types.stringLiteral(word.substring(0, firstCharNotSpaceIndex));
    }
    if (lastSpace) {
        wordMatchPart = word.substring(firstCharNotSpaceIndex, lastSpace.index);
        rightPart = types.stringLiteral(word.substring(lastSpace.index));
    } else {
        wordMatchPart = word.substring(firstCharNotSpaceIndex);
    }
    wordMatchPart = types.callExpression(
        types.identifier(calle),
        [
            types.stringLiteral('' + wordKeyMap[wordMatchPart])
        ]
    );
    leftPart && result.push(leftPart);
    result.push(wordMatchPart);
    rightPart && result.push(rightPart);
    return result
};

const createT = ({originValue, wordKeyMap, calle}) => {
    if (!globalSetting.localePattern.test(originValue)) {
        return
    }
    const splits = [];
    const wordByLines = originValue.split('\n');
    wordByLines.forEach(wordLine => {
        const res = createSplitNode({word: wordLine, wordKeyMap, calle});
        splits.push(...res);
    });

    if (!splits.length) {
        return
    }
    if (splits.length === 1) {
        return splits[0]
    } else {
        const recurExp = (nodeList) => {
            if (nodeList.length > 2) {
                const lastIndex = nodeList.length -1;
                const right = nodeList[lastIndex];
                const left = recurExp(nodeList.slice(0, lastIndex));
                return types.binaryExpression('+', left, right)
            } else {
                return types.binaryExpression('+', nodeList[0], nodeList[1])
            }
        };
        const result = recurExp(splits);
        return result
    }
};

function transMethodArg({path, originValue}) {
    const argI = path.parent.arguments.findIndex(item => item.type === 'StringLiteral' && item.value === originValue);
    path.parent.arguments[argI] = createT(arguments[0]);
}

function transArrayEle({path, originValue}) {
    const eleI = path.parent.elements.findIndex(item => item.type === 'StringLiteral' && item.value === originValue);
    path.parent.elements[eleI] = createT(arguments[0]);
}

function transVarDec({path}) {
    path.parent.init = createT(arguments[0]);
}

function transBinaryExp({path, originValue}) {
    const left = path.parent.left;
    if (left.type === 'StringLiteral' && left.value === originValue) {
        path.parent.left = createT(arguments[0]);
    } else {
        path.parent.right = createT(arguments[0]);
    }
}

/**
 *  a: b
 * @param {*} param0
 * @param {*} calle
 */
function transObjectValue({path}) {
    path.parent.value = createT(arguments[0]);
}

/**
 * a ? b : c
 * @param {*} param0
 * @param {*} calle
 */
function transCondExp({path, originValue}) {
    const { consequent, alternate, test } = path.parent;
    if (test.type === 'StringLiteral' && test.value === originValue) {
        path.parent.test = createT(arguments[0]);
    } else if (consequent.type === 'StringLiteral' && consequent.value === originValue) {
        path.parent.consequent = createT(arguments[0]);
    } else if (alternate.type === 'StringLiteral' && alternate.value === originValue) {
        path.parent.alternate = createT(arguments[0]);
    }
}

/**
 * a || b
 * @param {*} param0
 * @param {*} calle
 */
function transLogicExp({path, originValue}) {
    const { left, right } = path.parent;
    if (left.type === 'StringLiteral' && left.value === originValue) {
        path.parent.left = createT(arguments[0]);
    } else if (right.type === 'StringLiteral' && right.value === originValue) {
        path.parent.right = createT(arguments[0]);
    }
}

/**
 * return xx
 * @param {*} param0
 * @param {*} calle
 */
function transReturnState({path}) {
    path.parent.argument = createT(arguments[0]);
}

/**
 * a = xxx
 * @param {*} param0
 * @param {*} calle
 */
function transAssign({path, originValue}) {
    const { right } = path.parent;
    if (right.type === 'StringLiteral' && right.value === originValue) {
        path.parent.right = createT(arguments[0]);
    }
}

function transCode ({path, originValue, wordKeyMap, calle}) {
    switch (path.parent.type) {
        case 'NewExpression':
        case 'CallExpression': transMethodArg(arguments[0]); break
        case 'ArrayExpression': transArrayEle(arguments[0]); break
        case 'VariableDeclarator': transVarDec(arguments[0]); break
        case 'BinaryExpression': transBinaryExp(arguments[0]); break
        case 'ObjectProperty': transObjectValue(arguments[0]); break
        case 'ConditionalExpression': transCondExp(arguments[0]); break
        case 'LogicalExpression': transLogicExp(arguments[0]); break
        case 'ReturnStatement': transReturnState(arguments[0]); break
        case 'AssignmentExpression':
        case 'AssignmentPattern': transAssign(arguments[0]); break
    }
}

function getParent (path, deep = 1) {
    if (deep > 1) {
        let tempPath = path;
        for (let i = 0; i < deep - 1; i++) {
            tempPath = tempPath.parentPath;
        }
        try {
            return tempPath.parent
        } catch (e) {
            return undefined
        }
    } else {
        return path.parent
    }
}

function i18nTransform ({id, code}, options) {
    const collection = [];
    const keyInCodes = [];
    let loadedDependency = false;
    const {
        i18nCallee = '',
        alias = [],
        dependency, // {name, value, objectPattern}
        transform = true,
        localePattern,
    } = options || {};
    

    let ast = parser.parse(code, {
        sourceType: 'unambiguous'
    });

    function isInConsole (path) {
        const { type: parentType, callee: parentCallee } = path.parent;
        if (parentType === 'CallExpression' && parentCallee.type === 'MemberExpression') {
            const parentCalleeObject = parentCallee.object;
            if (parentCalleeObject.type === 'Identifier' && parentCalleeObject.name === 'console') {
                return true
            }
        }
        return false
    }
    function findCommentExclude(path) {
        //If from TemplateLiteral to StringLiteral
        if (!path.node.loc) {
            return false
        }
        const startLine = path.node.loc.start.line;
        const leadingComments = path.node.leadingComments;
        const check = (commentList) => {
            if (commentList && commentList.length) {
                const end = commentList.some(comment => {
                    return comment.type === 'CommentBlock' && comment.value.trim() === 'no-i18n-auto' && comment.loc.start.line === startLine
                });
                return end
            }
        };
        return (check(leadingComments) || check(ast.comments))
    }
    /**
     * vue file special rule to disable transform
     * @param {Object} path 
     * @returns {Boolean} true means disabled
     */
    function matchVueFileSpecialRule (path) {
        const pathParent = path.parent;
        if (/\.vue$/.test(id)
            && pathParent.type === 'CallExpression'
            && pathParent.callee.type === 'Identifier'
            && pathParent.callee.name === '_createCommentVNode'
        ) {
            return true
        }
        // vue file has special sfc render export function
        if (/\.vue$/.test(id) && pathParent.type === 'ArrayExpression') {
            const firstElement = pathParent.elements[0];
            if (firstElement.type === 'StringLiteral' && firstElement.value === '__file') {
                const theParent = getParent(path, 2);
                if (theParent && theParent.type === 'ArrayExpression') {
                    const theParent2 = getParent(path, 3);
                    if (theParent2 && theParent2.type === 'CallExpression') {
                        const theParent3 = getParent(path, 4);
                        if (theParent2.callee.name === '_export_sfc' && theParent3 && theParent3.type === 'ExportDefaultDeclaration') {
                            return true
                        }
                    }
                }
            }
        }
        return false
    }

    const visitor = {
        // Finds if the user's dependency is in the import declaration
        ImportDeclaration (path) {
            if (!transform || !dependency || loadedDependency) {
                return
            }
            if (dependency.value !== path.node.source.value) {
                return
            }
            const matched = path.node.specifiers.some(item => {
                if (item.type === 'ImportDefaultSpecifier') {
                    return item.local.name === dependency.name
                } else if (item.type === 'ImportSpecifier') {
                    return item.imported.name === dependency.name
                }
            });
            matched && (loadedDependency = true);
        },
        VariableDeclarator (path) {
            if (!transform || !dependency || loadedDependency) {
                return
            }
            const initNode = path.node.init;
            if (!initNode || initNode.type !== 'CallExpression') {
                return
            }
            let valueMatched = false;
            let nameMatched = false;
            const initNodeCallee = initNode.callee;
            if (initNodeCallee.type === 'Identifier' && initNodeCallee.name === 'require') {
                const args = initNode.arguments;
                if (args.length && dependency.value === args[0].value) {
                    valueMatched = true;
                }
            }
            if (dependency.objectPattern) {
                if (path.node.id.type === 'ObjectPattern') {
                    path.node.id.properties.forEach(item => {
                        if (item.key.type === 'Identifier' && item.key.name === dependency.name) {
                            nameMatched = true;
                        }
                    });
                }
            } else {
                if (path.node.id.type === 'Identifier' && path.node.id.name === dependency.name) {
                    nameMatched = true;
                }
            }
            valueMatched && nameMatched && (loadedDependency = true);
        },
        CallExpression (path) {
            let wholeCallName = '';
            const recurName = (node) => {
                if (node.type === 'MemberExpression') {
                    recurName(node.object);
                    if (node.property.type === 'Identifier') {
                        wholeCallName += ('.' + node.property.name);
                    }
                } else if (node.type === 'Identifier') {
                    wholeCallName += ('.' + node.name);
                }
            };
            recurName(path.node.callee);
            wholeCallName = wholeCallName.substring(1);
            let i18nFnNames = [...alias];
            i18nFnNames.unshift(i18nCallee);
            i18nFnNames.forEach(fnName => {
                let matched = false;
                if (Object.prototype.toString.call(fnName) === '[object RegExp]') {
                    matched = fnName.test(wholeCallName);
                } else if (fnName === wholeCallName) {
                    matched = true;
                }
                if (matched) {
                    if (path.node.arguments.length) {
                        const arg0 = path.node.arguments[0];
                        if (arg0.type === 'StringLiteral') {
                            keyInCodes.push(arg0.value);
                        }
                    }
                }
            });
        },
        StringLiteral (path) {
            if (['ExportAllDeclaration', 'ImportDeclaration', 'ExportNamedDeclaration'].indexOf(path.parent.type) !== -1) {
                return
            }
            if (findCommentExclude(path)) {
                return
            }
            
            if (isInConsole(path)) {
                return
            }
            
            if (path.node.type === 'StringLiteral') {
                const val = path.node.value;
                if (localePattern.test(val)) {
                    if (matchVueFileSpecialRule(path)) {
                        return
                    }
                    const res = localeWordPattern(val);
                    if (res && res.length) {
                        const wordKeyMap = {};
                        res.forEach(word => {
                            const key = setConfig(word);
                            collection.push({[key]: word});
                            wordKeyMap[word] = key;
                        });
                        transform && transCode({path, originValue: val, wordKeyMap, calle: i18nCallee});
                    }
                }
            }
        },
        TemplateLiteral (path) {
            if (findCommentExclude(path)) {
                return
            }
            if (isInConsole(path)) {
                return
            }
            const hasWord = path.node.quasis.some(item => localePattern.test(item.value.raw));
            if (!hasWord) {
                return
            }
            let sections = path.node.expressions.map(node => {
                return {
                    start: node.start,
                    value: `(${generator.default(node).code})`
                }
            });
            path.node.quasis.forEach(node => {
                const string = node.value.raw;
                if (string) {
                    const _string = string.replace(/"/g, '\\"');
                    const element = {
                        start: node.start,
                        value: '"' + _string + '"'
                    };
                    const unshiftIndex = sections.findIndex(item => node.start < item.start);
                    unshiftIndex === -1 ? sections.push(element) : sections.splice(unshiftIndex, 0, element);
                }
            });
            let code = sections.map(item => item.value).join('+');
            code.indexOf('\n') !== -1 && (code = code.replace(/\n/g, '\\n'));
            code.indexOf('\r') !== -1 && (code = code.replace(/\r/g, '\\r'));
            code.indexOf('\t') !== -1 && (code = code.replace(/\t/g, '\\t'));
            path.replaceWithSourceString(code);
        }
    };
    traverse.default(ast, visitor);

    // Whether to collect the language to be internationalized
    const hasLang = !!collection.length;

    // If user set the dependency, which wants to import, but now hasn't imported, and has language to be internationalized
    if (transform && dependency && hasLang && !loadedDependency) {
        // Add the import declaration
        const { name, objectPattern } = dependency;
        const i18nImport =  `import ${objectPattern ? ('{' + name + '}') : name} from '${dependency.value}'`;
        const i18nImportAst = parser.parse(i18nImport, {
            sourceType: 'module'
        });
        ast.program.body = [].concat(i18nImportAst.program.body, ast.program.body);
    }

    const newCode = generator.default(ast, {}, code).code;

    setCurrentCompileResourceMap(id, collection, keyInCodes); // create the latest collection to this file in sourcemap variable

    return newCode
}

const createFileWidthPath = ({
    content, path: fileDir, filename
}) => {
    return new Promise((resolve, reject) => [
        fs.mkdir(fileDir, { recursive: true }, err => {
            if (err) {
                return reject(err)
            }
            fs.writeFile(path.resolve(fileDir, filename), content, err => {
                if (err) {
                    return reject(err)
                }
                return resolve()
            });
        })
    ])
};

const TmtClient = tencentcloud.tmt.v20180321.Client;

const translateTo = ({
    target,
    textConfig
}) => {
    const translateLenLimit = 2000; // a request content max length
    const secondRequestLimit = 5; // the max times per second to request
    let sum = 0;
    let splitConfig = {};
    let splitList = [];
    let secondList = [];

    for (const key in textConfig) {
        const value = textConfig[key];
        sum += value.length;
        if (value.length > translateLenLimit) {
            throw 'i18n-auto-webpack : translate error —— The translate request UnsupportedOperation.TextTooLong'
        }
        if (sum > translateLenLimit) {
            splitList.push(splitConfig);
            splitConfig = {};
            sum = value.length;
            splitConfig[key] = value;
        } else {
            splitConfig[key] = value;
        }
    }
    splitList.push(splitConfig);
    const groupNum = Math.ceil(splitList.length / secondRequestLimit);
    for (let i = 0; i < groupNum; i++) {
        const start = i * secondRequestLimit;
        secondList.push(splitList.slice(start, start + 5));
    }
    return timeOutSend(target, secondList, 0)
};

const timeOutSend = (target, secondList, i) => {
    return new Promise((resolve, reject) => {
        const list = secondList[i];
        const promises = [];
        list.forEach(item => {
            const promise = send(target, item);
            promises.push(promise);
        });
        Promise.all(promises).then(res => {
            const result = res.reduce((config, result) => {
                return Object.assign(result, config)
            }, {});
            const nextI = i + 1;
            if (nextI < secondList.length) {
                setTimeout(async () => {
                    const res = await timeOutSend(target, secondList, nextI);
                    Object.assign(result, res);
                    return resolve(result)
                }, nextI * 1100);
            } else {
                return resolve(result)
            }
        }).catch(err => {
            reject(err);
        });
    })
};

/**
 * send the request to translate
 */
const send = (target, textConfig) => {
    const {
        secretId,
        secretKey,
        region,
        endpoint,
        source,
        projectId,
    } = globalSetting.translate || {};
    const clientConfig = {
        credential: {
            secretId,
            secretKey,
        },
        region,
        profile: {
            httpProfile: {
                endpoint
            }
        }
    };
    return new Promise((resolve, reject) => {
        let result = {};
        const keys = Object.keys(textConfig);
        const values = Object.values(textConfig);
        const params = {
            Source: source,
            Target: target,
            ProjectId: projectId,
            SourceTextList: values
        };
        const client = new TmtClient(clientConfig);
        client.TextTranslateBatch(params).then(
            (data) => {
                keys.forEach((key, index) => {
                    result[key] = data.TargetTextList[index];
                });
                return resolve(result)
            },
            err => {
                console.error("i18n-auto-webpack : translate error", err);
                return reject(err)
            }
        );
    })
};

const createTranslate = (target, source, needFile = true) => {
    return new Promise((resolve, reject) => {
        const {
            path,
            lang,
            nameRule
        } = target;
        const {
            path: sourcePath,
            text,
        } = source;
        const localeConfig = text || JSON.parse(fs.readFileSync(sourcePath, { encoding: 'utf8' }));
        const result = {};
        const translateLang = (index) => {
            const item = lang[index];
            const fileName = nameRule(item);
            const filePath = path + '/' + fileName;
            let deletedKeys = [];
            fs.access(filePath, fs.constants.F_OK, async (err) => {
                let translateWordConfig = {};
                let langConfig = {};
                if (err) {
                    for (const key in localeConfig) {
                        translateWordConfig[key] = localeConfig[key];
                    }
                } else {
                    langConfig = fs.readFileSync(filePath, { encoding: 'utf8' });
                    langConfig = JSON.parse(langConfig);
                    deletedKeys = Object.keys(langConfig).filter(key => !Object.keys(localeConfig).some(localeKey => localeKey === key));
                    deletedKeys.forEach(key => {
                        delete langConfig[key];
                    });
                    for (const key in localeConfig) {
                        if (!langConfig[key]) {
                            translateWordConfig[key] = localeConfig[key];
                        }
                    }
                }
                const translationFileParam = {
                    content: JSON.stringify(langConfig),
                    path,
                    filename: fileName
                };
                if (Object.keys(translateWordConfig).length) {
                    if (!validateLimit(translateWordConfig)) {
                        return reject(`translate ${item} failed: The terms that need to be translated exceed the free quota for characters!`)
                    }
                    try {
                        const translateRes = await translateTo({
                            target: item,
                            textConfig: translateWordConfig
                        });
                        Object.assign(langConfig, translateRes);
                        
                        translationFileParam.content = JSON.stringify(langConfig);
                        needFile && createFileWidthPath(translationFileParam);
                        result[item] = langConfig;
                    } catch (e) {
                        return reject(e)
                    }
                } else if (deletedKeys.length) {
                    needFile && createFileWidthPath(translationFileParam);
                }
                index++;
                if (index < lang.length) {
                    setTimeout(() => {
                        translateLang(index);
                    }, 1100);
                } else {
                    return resolve(result)
                }
            });
        };
        translateLang(0);
    })
};

function validateLimit (textConfig) {
    const { startTotal, endTotal } = globalSetting.translate || {};
    if (endTotal === Infinity) {
        return true
    }
    let len = 0;
    for (const key in textConfig) {
        len += textConfig[key].length;
    }
    const total = startTotal + len;
    if (total > endTotal) {
        return false
    }
    globalSetting.translate.startTotal = total;
    return true
}

let dirCreated$1 = false;
let mkdiring$1 = false;
let hasDirAfterWriteTask$1 = false;
let wirteTaskTimer$1 = null;
let writeTaskStash$1 = [];

function generate$1 ({path: dir, filename}) {
    let mapSource = getResource();
    mapSource = JSON.stringify(mapSource);

    // 把正在写配置的操作中断了，使用最新的写操作
    writeTaskStash$1.forEach(ctrl => {
        ctrl.abort();
    });
    writeTaskStash$1 = [];
    const controller = new AbortController();
    const { signal } = controller;
    writeTaskStash$1.push(controller);
    promises.writeFile(path.resolve(dir, filename), mapSource, { signal });
}

// 防抖
// 对生成配置文件的写操作进行防抖
function debounceWrite$1 (output) {
    if (wirteTaskTimer$1) {
        clearTimeout(wirteTaskTimer$1);
    }
    const timer = setTimeout(() => {
        generate$1(output);
        wirteTaskTimer$1 = null;
    }, 300);
    wirteTaskTimer$1 = timer;
}

async function createResouceMap (output) {
    if (!dirCreated$1) {
        if (mkdiring$1) {
            hasDirAfterWriteTask$1 = true;
        }
        try {
            mkdiring$1 = true;
            await promises.mkdir(output.path, { recursive: true });
            dirCreated$1 = true;
            // 创建文件夹过程中有需要创建本地配置文件的情况，在创建时被中断了，所以在创建结束后再执行一次
            hasDirAfterWriteTask$1 && debounceWrite$1(output);
        } catch (err) {
            console.error('🚀 ~ file: resourceMap.js:53 ~ err:', err);
        }
        mkdiring$1 = false;
    }
    
    debounceWrite$1(output);
}

let dirCreated = false;
let mkdiring = false;
let hasDirAfterWriteTask = false;
let wirteTaskTimer = null;
let writeTaskStash = [];

function generate ({path: dir, filename}) {
    const localeWordConfig = createConfigbyMap();
    let content = {};
    for (const key in localeWordConfig) {
        if (Object.prototype.hasOwnProperty.call(localeWordConfig, key)) {
            content[key] = localeWordConfig[key].value || '';
        }
    }
    updateConfig(content);
    content = JSON.stringify(content);

    // 把正在写配置的操作中断了，使用最新的写操作
    writeTaskStash.forEach(ctrl => {
        ctrl.abort();
    });
    writeTaskStash = [];
    const controller = new AbortController();
    const { signal } = controller;
    writeTaskStash.push(controller);
    promises.writeFile(path.resolve(dir, filename), content, { signal });
}

// 防抖
// 对生成配置文件的写操作进行防抖
function debounceWrite (output) {
    if (wirteTaskTimer) {
        clearTimeout(wirteTaskTimer);
    }
    const timer = setTimeout(() => {
        generate(output);
        wirteTaskTimer = null;
    }, 300);
    wirteTaskTimer = timer;
}

async function createLocaleWordConfig (output) {
    if (!dirCreated) {
        if (mkdiring) {
            hasDirAfterWriteTask = true;
        }
        try {
            mkdiring = true;
            await promises.mkdir(output.path, { recursive: true });
            dirCreated = true;
            // 创建文件夹过程中有需要创建本地配置文件的情况，在创建时被中断了，所以在创建结束后再执行一次
            hasDirAfterWriteTask && debounceWrite(output);
        } catch (err) {
            console.error('🚀 ~ file: wordConfig.js:59 ~ err:', err);
        }
        mkdiring = false;
    }
    
    debounceWrite(output);
}

/**
 * create i18n language config files
 */
const handleTranslate = async (translation) => {
    const localeConfigOrigin = createConfigbyMap();
    const localeConfig = {};
    for (const key in localeConfigOrigin) {
        localeConfig[key] = localeConfigOrigin[key].value;
    }
    try {
        await createTranslate(translation, {text: localeConfig});
    } catch (e) {
        console.error(e);
    }
};

function generateJson (setting) {
    const { output, translate, mode, sourceMap } = setting;
    const { configNeedUpdate, sourceMapNeedUpdate } = updateResourceMap();

    if (mode === 'build' && translate.on) {
        handleTranslate(translate);
    }
    if (output.generate && configNeedUpdate) {
        createLocaleWordConfig(output);
    }
    if (sourceMap.on && sourceMapNeedUpdate) {
        createResouceMap(sourceMap);
    }
}

function i18nAuto(options = {}) {
    const { setting } = init(options);
    const isBuildMode = setting.mode === 'build';
    return {
        name: 'i18n-auto',
        transform (code, id) {
            const filter = pluginutils.createFilter(setting.include, setting.exclude);
            if (!filter(id)) {
                return { code }
            }
            const newCode = i18nTransform({
                id,
                code
            }, setting);
            isBuildMode || generateJson(setting);
            return {
                code: newCode,
                map: null,
            }
        },
        generateBundle () {
            console.log('Generate i18n file successfully !');
            isBuildMode && generateJson(setting);
        },
    }
}

module.exports = i18nAuto;
