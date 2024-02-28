import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import generator from '@babel/generator'

import {
    transCode,
    localeWordPattern,
} from './transform.js';
import {
    setConfig,
    setCurrentCompileResourceMap,
} from '../common/collect.js'

function getParent (path, deep = 1) {
    if (deep > 1) {
        let tempPath = path
        for (let i = 0; i < deep - 1; i++) {
            tempPath = tempPath.parentPath
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

export default function i18nTransform ({id, code}, options) {
    const collection = []
    const keyInCodes = []
    let loadedDependency = false
    const {
        i18nCallee = '',
        alias = [],
        dependency, // {name, value, objectPattern}
        transform = true,
        localePattern,
    } = options || {}
    

    let ast = parse(code, {
        sourceType: 'unambiguous'
    })

    function isInConsole (path) {
        const { type: parentType, callee: parentCallee } = path.parent
        if (parentType === 'CallExpression' && parentCallee.type === 'MemberExpression') {
            const parentCalleeObject = parentCallee.object
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
        const startLine = path.node.loc.start.line
        const leadingComments = path.node.leadingComments
        const check = (commentList) => {
            if (commentList && commentList.length) {
                const end = commentList.some(comment => {
                    return comment.type === 'CommentBlock' && comment.value.trim() === 'no-i18n-auto' && comment.loc.start.line === startLine
                })
                return end
            }
        }
        return (check(leadingComments) || check(ast.comments))
    }
    /**
     * vue file special rule to disable transform
     * @param {Object} path 
     * @returns {Boolean} true means disabled
     */
    function matchVueFileSpecialRule (path) {
        const pathParent = path.parent
        if (/\.vue$/.test(id)
            && pathParent.type === 'CallExpression'
            && pathParent.callee.type === 'Identifier'
            && pathParent.callee.name === '_createCommentVNode'
        ) {
            return true
        }
        // vue file has special sfc render export function
        if (/\.vue$/.test(id) && pathParent.type === 'ArrayExpression') {
            const firstElement = pathParent.elements[0]
            if (firstElement.type === 'StringLiteral' && firstElement.value === '__file') {
                const theParent = getParent(path, 2)
                if (theParent && theParent.type === 'ArrayExpression') {
                    const theParent2 = getParent(path, 3)
                    if (theParent2 && theParent2.type === 'CallExpression') {
                        const theParent3 = getParent(path, 4)
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
            })
            matched && (loadedDependency = true)
        },
        VariableDeclarator (path) {
            if (!transform || !dependency || loadedDependency) {
                return
            }
            const initNode = path.node.init
            if (!initNode || initNode.type !== 'CallExpression') {
                return
            }
            let valueMatched = false
            let nameMatched = false
            const initNodeCallee = initNode.callee
            if (initNodeCallee.type === 'Identifier' && initNodeCallee.name === 'require') {
                const args = initNode.arguments
                if (args.length && dependency.value === args[0].value) {
                    valueMatched = true
                }
            }
            if (dependency.objectPattern) {
                if (path.node.id.type === 'ObjectPattern') {
                    path.node.id.properties.forEach(item => {
                        if (item.key.type === 'Identifier' && item.key.name === dependency.name) {
                            nameMatched = true
                        }
                    })
                }
            } else {
                if (path.node.id.type === 'Identifier' && path.node.id.name === dependency.name) {
                    nameMatched = true
                }
            }
            valueMatched && nameMatched && (loadedDependency = true)
        },
        CallExpression (path) {
            let wholeCallName = ''
            const recurName = (node) => {
                if (node.type === 'MemberExpression') {
                    recurName(node.object)
                    if (node.property.type === 'Identifier') {
                        wholeCallName += ('.' + node.property.name)
                    }
                } else if (node.type === 'Identifier') {
                    wholeCallName += ('.' + node.name)
                }
            }
            recurName(path.node.callee)
            wholeCallName = wholeCallName.substring(1)
            let i18nFnNames = [...alias]
            i18nFnNames.unshift(i18nCallee)
            i18nFnNames.forEach(fnName => {
                let matched = false
                if (Object.prototype.toString.call(fnName) === '[object RegExp]') {
                    matched = fnName.test(wholeCallName)
                } else if (fnName === wholeCallName) {
                    matched = true
                }
                if (matched) {
                    if (path.node.arguments.length) {
                        const arg0 = path.node.arguments[0]
                        if (arg0.type === 'StringLiteral') {
                            keyInCodes.push(arg0.value)
                        }
                    }
                }
            })
        },
        StringLiteral (path) {
            if (path.parent.type === 'ImportDeclaration') {
                return
            }
            if (findCommentExclude(path)) {
                return
            }
            
            if (isInConsole(path)) {
                return
            }
            
            if (path.node.type === 'StringLiteral') {
                const val = path.node.value
                if (localePattern.test(val)) {
                    if (matchVueFileSpecialRule(path)) {
                        return
                    }
                    const res = localeWordPattern(val)
                    if (res && res.length) {
                        const wordKeyMap = {}
                        res.forEach(word => {
                            const key = setConfig(word)
                            collection.push({[key]: word})
                            wordKeyMap[word] = key
                        })
                        transform && transCode({path, originValue: val, wordKeyMap, calle: i18nCallee})
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
            const hasWord = path.node.quasis.some(item => localePattern.test(item.value.raw))
            if (!hasWord) {
                return
            }
            let sections = path.node.expressions.map(node => {
                return {
                    start: node.start,
                    value: generator.default(node).code
                }
            })
            path.node.quasis.forEach(node => {
                const string = node.value.raw
                if (string) {
                    const element = {
                        start: node.start,
                        value: '"' + string + '"'
                    }
                    const unshiftIndex = sections.findIndex(item => node.start < item.start)
                    unshiftIndex === -1 ? sections.push(element) : sections.splice(unshiftIndex, 0, element)
                }
            })
            const code = sections.map(item => item.value).join('+')
            path.replaceWithSourceString(code)
        }
    }
    traverse.default(ast, visitor)

    // Whether to collect the language to be internationalized
    const hasLang = !!collection.length

    // If user set the dependency, which wants to import, but now hasn't imported, and has language to be internationalized
    if (transform && dependency && hasLang && !loadedDependency) {
        // Add the import declaration
        const { name, objectPattern } = dependency
        const i18nImport =  `import ${objectPattern ? ('{' + name + '}') : name} from '${dependency.value}'`
        const i18nImportAst = parse(i18nImport, {
            sourceType: 'module'
        })
        ast.program.body = [].concat(i18nImportAst.program.body, ast.program.body)
    }

    const newCode = generator.default(ast, {}, code).code

    setCurrentCompileResourceMap(id, collection, keyInCodes) // create the latest collection to this file in sourcemap variable

    return newCode
}
