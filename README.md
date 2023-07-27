# rollup-plugin-i18n-auto
This is a tools to help you work i18n automatically in rollup or vite project.

这是一个可以帮助你实现自动国际化工作的工具，可以用在基于rollup或vite构建的项目上。

> 该工具的实现思想跟 [i18n-auto-webpack](https://github.com/pekonchan/i18n-auto-webpack) 是一样的，这个是rollup版本。具体实现思想与初衷见 [我搞了个可以全自动化国际化的工具...](https://juejin.cn/post/7209967260898525242)

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
import i18nAuto from 'rollup-plugin-i18n-auto'

export default defineConfig({
  plugins: [
    vue(),
    // 这里是一个最简单的配置情况，针对所有的js 和vue文件，找出其中的中文，进行替换成i18n.global.t('xxx')的形式。
    // 同时会在代码中添加 import i18n from '/src/i18n/index.js'
    i18nAuto({
      include: ['**.js', '**.vue'],
      name: 'i18n.global.t',
      dependency: {
        name: 'i18n',
        value: '/src/i18n/index.js'
      }
    })
  ],
})
```
