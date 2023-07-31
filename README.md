# rollup-plugin-i18n-auto
This is a tools to help you work i18n automatically in rollup or vite project.

这是一个可以帮助你实现自动国际化工作的工具，可以用在基于rollup或vite构建的项目上。

> 该工具的实现思想跟 [i18n-auto-webpack](https://github.com/pekonchan/i18n-auto-webpack) 是一样的，这个是rollup版本。具体实现思想与初衷见 [我搞了个可以全自动化国际化的工具...](https://juejin.cn/post/7209967260898525242)

该工具能够帮助你自动完成以下工作：
1. 收集需要进行国际化的词条，生成JSON配置文件
2. 自动转换源码中的需要国际化的词条，而无须你改动源码上的词条，会在代码编译阶段自动完成该操作
3. 支持自动根据生成的JSON词条配置文件，翻译成指定的其他国家语言，生成对应的JSON配置文件
4. 支持生成每个文件中有哪些国际化词条，并且条数是多少的source map JSON文件。

上述工作分别可单独设置工作与否。

以一份代码为例子进行说明该工具会做了什么事情：
```
// 源码 example.js
const test = '你好'

// 经过工具转化后，源码变成
import i18n from '/src/i18n/index.js'

const test = i18n.global.t('0')

// 生成了一份JSON文件，里面的内容是：
{
  "0": "你好"
}

// 生成了指定国家的语言包，也是JSON文件，里面内容是：
{
  "0": "Hello"
}

// 还能生成一份映射文件
{
  "example.js": {
    "0": {
      "value": "你好",
      "count": 1
    }
  }
}
```

# Install
```
npm i rollup-plugin-i18n-auto

yarn add rollup-plugin-i18n-auto

pnpm add rollup-plugin-i18n-auto
```

# Usage
这是一个rollup的插件，所以使用方式跟rollup的使用方式一样，[rollup使用插件教程](https://cn.rollupjs.org/tutorial/#using-plugins)，以及它也是可以被使用到`vite`项目中的，使用方法也是跟官方介绍的一致，[vite使用插件教程](https://cn.vitejs.dev/guide/using-plugins.html)

这里以`vite + vue`项目为例子进行介绍：
```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// 引入该工具包
import i18nAuto from 'rollup-plugin-i18n-auto'

export default defineConfig({
  plugins: [
    vue(),
    // 这里是一个最简单的配置情况，针对所有的js 和vue文件，找出其中的中文，进行替换成i18n.global.t('xxx')的形式。
    // 同时会在代码中添加 import i18n from '/src/i18n/index.js'
    // 并且自动生成了本地词条的JSON配置文件，并且自动进行了翻译成英文配置文件
    i18nAuto({
      include: ['**.js', '**.vue'], // 针对什么文件进行国际化词条
      i18nCallee: 'i18n.global.t', // 对需要进行国际化的词条进行转换的函数名
      dependency: { // 对需要进行国际化的词条进行转换的函数的引入依赖
        name: 'i18n',
        value: '/src/i18n/index.js'
      },
      translate: {
        on: true, // 开启自动翻译
        secretId: 'your secretId', // 若开启自动翻译，需要腾讯机器翻译的你的用户secretId
        secretKey: 'your secretKey' // // 若开启自动翻译，需要腾讯机器翻译的你的用户secretKey
      }
    })
  ],
})
```
> 开发环境使用，需要添加`mode: serve`，以及开发环境中不支持自动翻译，得在构建生产环境中使用。

#### 注意
该工具是帮助你完成了自动转换代码，但是转换成什么样的函数，得是你提供才行。每个框架的项目，都已经有成熟的国际化转换类库了，如`vue`的`vue-i18n`，`react`的`react-intl`和`react-i18next`，`angular`的`ngx-translate`等等。

所以你想要实现自动转换代码，前提是你的项目得要提供一个依赖，这个依赖就是用来将国际化词条转换成这个依赖的使用。这就是配置中的`i18nCallee, dependency`的情况。

## 仅自动翻译
若你只想使用自动翻译能力，其他能力不需要（自动生成代码词条配置文件、自动转译代码、生成source map）。

适合场景：你的项目里已有词条配置文件了，代码里也做好了转换，现在仅仅差各个语言的词条配置文件，即你只想实现翻译。

> 注意，翻译能力只能在项目的生产构建时使用，如`npm run build`. 就算你在开发环境配置中也设置了`true`，但是还是不起效的

最简单的配置如下（具体设置参考各个字段的说明）：
```
i18nAuto({
  include: ['**.js'], // 针对什么文件进行国际化词条
  output: {
    generate: false // 不生成代码词条配置文件
  },
  transform: false, // 不转译源码
  translate: {
    on: true, // 开启自动翻译
    secretId: 'your secretId', // 若开启自动翻译，需要腾讯机器翻译的你的用户secretId
    secretKey: 'your secretKey' // // 若开启自动翻译，需要腾讯机器翻译的你的用户secretKey
  }
})
```

翻译使用的是腾讯的机器翻译api，需要提供`secretId`和`secretKey`，具体获取方式见 [获取腾讯机器翻译用户信息](https://juejin.cn/post/7209967260898525242#heading-25)，跳转的这个外链的一个配置说明可忽略，这个配置文件是针对`i18n-auto-webpack`的。我们主要看下面的介绍

## 仅自动生成词条配置文件
若你只想根据代码中需要国际化的词条生成JSON文件整理出来，其他能力不需要（自动翻译配置、自动转译代码、生成source map）。

适合场景：不需要翻译，有专人翻译，并且你不想使用编译构建时转译代码，想直接写在源码中进行词条转换，你不想人工收集本地词条

最简单的配置如下（具体设置参考各个字段的说明）：
```
i18nAuto({
  mode: 'serve', // 开发环境中就必须得写serve，否则可不写或写build
  include: ['**.js'], // 针对什么文件进行国际化词条
  output: {
    generate: true // 生成代码词条配置文件，默认为true，不写也可以
  },
  transform: false // 不转译源码
})
```

## 仅自动转换源码
若你只想根据将代码中需要国际化的词条转换成国际化转换函数的依赖使用，其他能力不需要（自动翻译配置、自动生成收集源码词条配置、生成source map）

适合场景：不需要翻译，有专人翻译，也有维护好的源码词条配置文件，只是不想改动源码，影响开发习惯，想自动完成词条之间的代码转换。

最简单的配置如下（具体设置参考各个字段的说明）：
```
i18nAuto({
  include: ['**.js'], // 针对什么文件进行国际化词条
  exclude: ['src/i18n/index.js'], // 排除某个文件，一般国际化依赖的文件需要排除掉的，即下方的dependency.value
  output: {
    generate: false // 生成代码词条配置文件，默认为true，不写也可以
  },
  i18nCallee: 'i18n.global.t', // 例子
  dependency: {  // 例子
    name: 'i18n',
    value: '/src/i18n/index.js'
  },
  transform: true // 转译源码，不写也可以，默认是true
})
```

例如：
```
// 源码
const test = '你好'

// 经过工具转化后
import i18n from '/src/i18n/index.js'

const test = i18n.global.t('0')

// 0 是 '你好' 的 key {"0": "你好"}
```

## 仅生成映射文件
辅助功能，仅仅是生成一个JSON文件，里面记录着哪个文件里有哪些国际化词条，个数情况，其他能力都不需要。可能你需要这些信息来做更进一步的功能开发

最简单的配置如下（具体设置参考各个字段的说明）：
```
i18nAuto({
  mode: 'serve', // 开发环境中就必须得写serve，否则可不写或写build
  include: ['**.js'], // 针对什么文件进行国际化词条
  output: {
    generate: false // 生成代码词条配置文件，默认为true，不写也可以
  },
  transform: false, // 转译源码，不写也可以，默认是true
  sourceMap: true // 生成映射文件
})
```

## 各种组合情况
上述的各种单独能力，当然是可以相互组合一起使用的。你想使用哪些能力的组合，就按照相应的配置设置就好了。具体每个字段的设置说明，见下方的配置表

# 配置表
选项的具体说明如下：
| 配置项 | 描述 | 类型 | 必填 | 默认值 |
| ----- | ----| ---- | ---- | ------ |
| include | 针对哪些文件进行处理 | 可以是 minimatch 模式或 minimatch 模式数组 | 否 | - |
| exclude | 排除哪些文件 | 可以是 minimatch 模式或 minimatch 模式数组 | 否 | - |
| mode | 该插件所运行的模式，build为构建生产，serve为构建开发环境，想要在开发环境中发挥生成源码词配置表能力，必须要赋值serve | String | 否 | build |
| output | 源码词条配置JSON文件所在设置，有如下子属性 | Object | 否 | - |
| ouput.path | 源码词条配置JSON文件所在目录 | String | 否 | 项目根目录/lang |
| ouput.filename | 源码词条配置JSON文件的名字（带拓展名） | String | 否 | zh.json |
| ouput.generate | 是否需要生成源码词条配置JSON文件 | Boolean | 否 | true |
| transform | 是否需要自动将源码的词条进行转换成国际化转换函数，即转成你使用的诸如vue-i18n, react-i18next，ngx-translate等等提供的函数，自己写的自定义函数也行 | Boolean | 否 | true |
| i18nCallee | 将源码替换成国际化转换函数的调用名字。当你要使用国际化转换时，是怎么调用函数的，就怎么写这个字段 | String | transform配置为true时，必填 | - |
| dependency | 引入的国际化转换函数所需的依赖，有如下子属性 | Object | 否 | - |
| dependency.name | 引入的国际化转换函数所需的依赖的名字 | String | 设置了dependency就必填 | - |
| dependency.value | 引入的国际化转换函数所需的依赖的路径，对应的就是import name from 'xxx'里的xxx | String | 设置了dependency就必填 | - |
| dependency.objectPattern | 引入的国际化转换函数所需的依赖的形式。true为解构形式：import { name } from 'xxx' | Boolean | 否 | false |
| alias | 代码中调用国际化转换函数的别名，支持正则表达式，主要是用来识别源码中使用了国际化转换函数的情况 | Array | 否 | [] |
| localePattern | 需要国际化的词条规则 | 正则表达式 | 否 | `/[\u4e00-\u9fa5]/`，即中文 |
| keyRule | 自定义收集的词条key规则，接受两个入参，第一个是匹配到词条值，第二个是当时的词条配置记录变量 | Function | 否 | 数字聪0开始递增，遇到中间存在空缺数字会补上 |
| sourceMap | 映射文件配置，有如下属性 | Object | Boolean | 否 | false |
| sourceMap.on | 是否生成词条映射表，记录哪个文件有哪些词条 | Boolean | 否 | false |
| sourceMap.path | 生成的映射文件存放路径（不含文件名） | String | 否 | 项目根目录/lang |
| sourceMap.filename | 生成的映射文件名（不含路径） | String | 否 | zh.sourcemap.json |
| translate | 自动翻译的设置 | Object | 否 | false，不开启自动翻译 |
| translate.on | 是否开启翻译 | Boolean | 否 | false |
| translate.lang | 要翻译成哪些语言 | Array | 否 | ['en'],英文。语言的标识可参考[api](https://cloud.tencent.com/document/api/551/40566) |
| translate.path | 生成的翻译文件所在目录 | String | 否 | 项目根目录/lang，若设置了output，默认会跟着output.path |
| translate.nameRule | 生成的翻译文件名 | Function | 否 | nameRule (lang) {return lang + '.json' } |
| translate.startTotal | 表示你已经使用了多少字符额度了，本次启动服务触发的翻译字符数，将基于这个额度上进行计算 | Number | 否 | 0 |
| translate.startTotal | 表示你已经使用了多少字符额度了，本次启动服务触发的翻译字符数，将基于这个额度上进行计算 | Number | 否 | 0 |
| translate.endTotal | 当达到了指定的endTotal额度限制时，就不再触发翻译请求了。默认值就是腾讯翻译api的免费额度，不想限制传`Infinity` | Number | 否 | 5000000 |
| translate.secretId | 翻译api的用户身份secretId，请去腾讯云控制台查阅 | String | 开启了自动翻译，则必填 | - |
| translate.secretKey | 翻译api的用户身份secretKey，请去腾讯云控制台查阅 | String | 开启了自动翻译，则必填 | - |
| translate.region | 对哪个地区的语言进行翻译，配置就是跟腾讯机器翻译api对应的region | String | 否 | ap-beijing |
| translate.endpoint | 接口请求地址，配置就是跟腾讯机器翻译api对应的endpoint | String | 否 | 	tmt.tencentcloudapi.com |
| translate.source | 要进行翻译的语言 | String | 否 | zh |
| translate.projectId | 项目ID，可以根据控制台-账号中心-项目管理中的配置填写，如无配置请填写默认项目ID:0 | Number | 否 | 0 |

关于`translate`下的子属性，从`secretId`开始，都是遵循腾讯云翻译api的要求的配置。若想了解更多，可查阅 [腾讯云翻译api文档](https://cloud.tencent.com/document/api/551/40566)

**关于`startTotal`和`endTotal`**

因为腾讯翻译api一个月有免费的翻译文本数量限制，最多5百万字符，若超出，则需要付费了。所以`startTotal`和`endTotal`的设置会让你使用得更安心些。注意，`startTotal`只会从本次启动服务（如启动了dev-server）基于它进行累计计算。我们并不会知道之前的服务你使用了多少额度，所以你可能每次启动服务的时候都需要修改这个`startTotal`

> 可惜的是腾讯机器翻译api暂时还没有api可以查询用户使用额度
