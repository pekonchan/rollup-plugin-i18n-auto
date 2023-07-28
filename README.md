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
      name: 'i18n.global.t', // 对需要进行国际化的词条进行转换的函数名
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

#### 注意
该工具只是帮助你完成了

## 仅自动翻译
若你只想使用自动翻译能力，其他能力不需要（自动生成代码词条配置文件、自动转译代码、生成source map）。

适合场景：你的项目里已有词条配置文件了，代码里也做好了转换，现在仅仅差各个语言的词条配置文件，即你只想实现翻译。

> 注意，翻译能力只能在项目的生产构建时使用，如npm run build.

最简单的配置如下（具体设置参考各个字段的说明）：
```
i18nAuto({
  include: ['**.js', '**.vue'], // 针对什么文件进行国际化词条
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

## 仅自动生成词条配置文件
若你只想根据代码中需要国际化的词条生成JSON文件整理出来，其他能力不需要（自动翻译配置、自动转译代码、生成source map）。

适合场景：不需要翻译，有专人翻译，并且你不想使用编译构建时转译代码，想直接写在源码中进行词条转换，你不想人工收集本地词条

最简单的配置如下（具体设置参考各个字段的说明）：
```
i18nAuto({
  include: ['**.js', '**.vue'], // 针对什么文件进行国际化词条
  output: {
    generate: true // 生成代码词条配置文件，默认为true，不写也可以
  },
  transform: false // 不转译源码
})
```
