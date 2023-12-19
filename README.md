vue版本：2.6.14

# 前置知识

如 flow、源码目录、构建方式、编译入口等

### 源码目录

Vue.js 的目录设计可以看到，作者把功能模块拆分的非常清楚，相关的逻辑放在一个独立的目录下维护，并且把复用的代码也抽成一个独立目录。这样的目录设计让代码的阅读性和可维护性都变强

```
src
├── compiler        # 编译相关 
├── core            # 核心代码 
├── platforms       # 跨平台支持
├── server          # 服务端渲染
├── sfc             # .vue 文件解析
├── shared          # 全局共享代码
```

#### compiler

compiler 目录包含 vue 所有编译相关的代码。包括把模板解析成 ast 语法树，ast 语法树优化，代码生成等功能。

编译的工作可以在构建时做（借助 webpack、vue-loader 等辅助插件）；也可以在运行时做，使用包含构建功能的 Vue.js。显然，编译是一项耗性能的工作，所以更推荐前者——离线编译

#### core

core 目录包含了 Vue.js 的核心代码，包括内置组件、全局 API 封装，Vue 实例化、观察者、虚拟 DOM、工具函数等。需重点解析

#### platform

Vue.js 是一个跨平台的 MVVM 框架，它可以跑在 web 上，也可以配合 weex 跑在 native 客户端上。platform 是 Vue.js 的入口，2 个目录代表 2 个主要入口，分别打包成运行在 web 上和 weex 上的 Vue.js。

我们会重点分析 web 入口打包后的 Vue.js

#### server

Vue.js 2.0 支持了服务端渲染，所有服务端渲染相关的逻辑都在这个目录下。注意：这部分代码是跑在服务端的 Node.js，不要和跑在浏览器端的 Vue.js 混为一谈。

服务端渲染主要的工作是把组件渲染为服务器端的 HTML 字符串，将它们直接发送到浏览器，最后将静态标记"混合"为客户端上完全交互的应用程序。

#### sfc

通常我们开发 Vue.js 都会借助 webpack 构建， 然后通过 .vue 单文件来编写组件。

这个目录下的代码逻辑会把 .vue 文件内容解析成一个 JavaScript 的对象

#### shared

定义一些工具方法，这里定义的工具方法都是会被浏览器端的 Vue.js 和服务端的 Vue.js 所共享的

## 源码构建

查看`package.json`中的构建脚本命令

```
{
  "script": {
    "build": "node scripts/build.js",
    "build:ssr": "npm run build -- web-runtime-cjs,web-server-renderer",
    "build:weex": "npm run build -- weex"
  }
}
```

可以看到构建脚本是在`scripts/build.js`中的，部分源码如下：

```javascript
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist')
}

// 这段代码的逻辑是：1.先从配置文件读取配置，
let builds = require('./config').getAllBuilds()
// 2.再通过命令行参数对构建配置做过滤，以此构建出不同版本的Vue.js。
if (process.argv[2]) {
  const filters = process.argv[2].split(',')
  // 通过命令行参数构建过滤器
  builds = builds.filter(b => {
    return filters.some(f => b.output.file.indexOf(f) > -1 || b._name.indexOf(f) > -1)
  })
} else {
  // 在默认情况下过滤出 weex 构建
  builds = builds.filter(b => {
    return b.output.file.indexOf('weex') === -1
  })
}
// 3.经过 Rollup 的构建打包后，最终会在 dist 目录下生成 vue.runtime.common.js
build(builds)

/**
 *
 * @param builds 构建数组
 * @description 按顺序处理一个构建任务数组中的每个构建任务
 */
function build (builds) {
  let built = 0
  const total = builds.length
  const next = () => {
    buildEntry(builds[built]).then(() => {
      built++
      if (built < total) {
        next()
      }
    }).catch(logError)
  }

  next()
}
```

`scripts/build.js`逻辑较为简单：先从配置文件读取配置，再通过命令行参数对构建配置做过滤，以此构建出不同版本的Vue.js。经过 Rollup 的构建打包后，最终会在 dist 目录下生成 `vue.runtime.common.js`

接下来看一下配置文件，在 `scripts/config.js` 中，主要列举了一些 Vue.js 构建的配置

```javascript
/**
 * @description 列举了关于Vue.js构建的配置，包括服务端渲染、webpack插件、wexx等的打包配置。对于单个配置，其遵循Rollup的构建规则
 */
const builds = {
  /*
  * entry: 构建的入口JS文件地址
  * dest: 构建后的JS文件地址
  * format: 构建格式
  * cjs: 构建出来的文件遵循 CommonJS 规范
  * es: 构建出来的文件遵循 ES Module 规范
  * */

  // Runtime only (CommonJS). Used by bundlers e.g. Webpack & Browserify
  'web-runtime-cjs-dev': {
    entry: resolve('web/entry-runtime.js'),
    dest: resolve('dist/vue.runtime.common.dev.js'),
    format: 'cjs',
    env: 'development',
    banner
  },
    'web-runtime-cjs-prod': {
    entry: resolve('web/entry-runtime.js'),
    dest: resolve('dist/vue.runtime.common.prod.js'),
    format: 'cjs',
    env: 'production',
    banner
  },
  // Runtime+compiler CommonJS build (CommonJS)
  'web-full-cjs-dev': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.common.dev.js'),
    format: 'cjs',
    env: 'development',
    alias: { he: './entity-decoder' },
    banner
  },
}
```

## Runtime Only VS Runtime + Compiler

- Runtime Only

在使用 Runtime Only 版本的 Vue.js 的时候，通常需要借助如 webpack 的 vue-loader 工具把 .vue 文件编译成 JavaScript，所以它只包含运行时的 Vue.js 代码，代码体积也会更轻量。常用此版本

- Runtime + Compiler

如果没有对代码做预编译，但是又使用了Vue的template属性并传入字符串，则需要在客户端编译模板，例如：

```javascript
// 需要编译的版本
new Vue({
  template:`<div>{{ hello }}</div>`
})

// 这种情况不需要
new Vue({
  render (h) {
    return h('div', this.hi)
  }
})
```

在Vue2中，最终渲染都是通过`render`函数渲染的，因此如果使用`template` 属性的写法，会先编译成`render`函数，所以需要带有编译器版本。这个编译过程对性能会有一定损耗

## 入口

分析一下Runtime + Compiler构建出来的Vue.js，入口文件为：`src/platform/web/entry-runtime-with-compiler.js`

从代码中可以看出，首先引入了Vue

`import Vue from './runtime/index' `

在`runtime/index`中，关键代码是：`import Vue from 'core/index`，`core/index`是真正初始化Vue的地方，之后的逻辑都是对导入的Vue对象做拓展做一些拓展。

### 导入Vue实例

`src/core/index`

```javascript
import Vue from './instance/index' // 1.导入Vue构造函数 该函数主要是在Vue的 prototype 扩展方法
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from 'core/util/env'
import { FunctionalRenderContext } from 'core/vdom/create-functional-component'

/**
 * 2.初始化全局API
 * Vue在整个初始化过程，除了给它的原型 prototype 上扩展方法(./instance/index)，还会在initGlobalAPI中给Vue构造函数本身拓展全局静态方法
 */
initGlobalAPI(Vue)

Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})

Object.defineProperty(Vue.prototype, '$ssrContext', {
  get () {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

// expose FunctionalRenderContext for ssr runtime helper installation
Object.defineProperty(Vue, 'FunctionalRenderContext', {
  value: FunctionalRenderContext
})

Vue.version = '__VERSION__'

export default Vue
```

`src/core/instance/index`

```javascript
import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

/**
 *
 * @param options 配置项
 * @constructor
 * @description 终于看到了 Vue 的真身，它其实就是Function实现的类，可以通过new Vue去实例化
 */
function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

export default Vue
```

可以看到，Vue实际上就是一个用Function实现的类，因此需要通过`new Vue`实例化

>  * 为什么不用ES6的Class ?
>    * 可以看到后面有很多 xxxMixin 方法，都是把Vue构造函数作为形参使用，点进其方法实现可以看到都是给Vue的prototype上拓展一些方法。
>    * Vue 按功能把这些扩展分散到多个模块中去实现，而不是在一个模块里实现所有，这种方式是用 Class 难以实现的。方便代码的维护和管理
>    * 退一步说，class关键字创建的函数不能通过call,bind,apply改变this指向，Funtion可以。且使用Class实现的话，其实例方法很容易和原型上的方法混淆。如：
>
>  ```javascript
>  class A{
>   constructor(options){}
>   someFunction(){console.log('from prototype');}
>   }
>  
>  A.prototype.someFunction=function(){
>    console.log('from prototype');
>  }
>  let app = new M();
>  app.someFunction()
>  ```

### 初始化全局API

入口文件中第二步会通过`initGlobalAPI(Vue)`初始化全局API，本质上就是给Vue拓展全局的静态方法，其定义在`src/core/global-api/index`中

```javascript
/* @flow */
/**
 * 该文件主要是在 Vue 上扩展的一些全局方法的定义，Vue官网中全局的API都可以在这里找到
 */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    // 非生产环境 拦截Vue.config.set  当修改Vue.config时直接报错
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 explicit observable API
  Vue.observable = <T>(obj: T): T => {
    observe(obj)
    return obj
  }

  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  Vue.options._base = Vue

  extend(Vue.options.components, builtInComponents)

  initUse(Vue)
  initMixin(Vue)
  initExtend(Vue)
  initAssetRegisters(Vue)
}
```

Vue官网中关于全局API都可以在这里找到

# 数据驱动

Vue是数据驱动的，对视图的修改，不会直接操作 DOM，而是通过修改数据，通过简洁的模板语法来声明式地将数据渲染进 DOM 的系统

```javascript
<div id="app">
  {{ message }}
</div>

let app = new Vue({
  el: '#app',
  data: {
    message: 'Hello Vue!'
  }
})
```

## new Vue的过程

在vue项目中需要通过`new Vue`实例化Vue对象。前面也看到了，源码中是在`core/instance/index`中实现的Vue类

```javascript
function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}
```

可以看到在初始化Vue实例时，会调用`this._init` 方法进行初始化， 该方法在 `src/core/instance/init.js` 中的`initMixin`方法中实现，是挂载在Vue原型上的

```javascript
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
```

在初始化时候，主要做了这几件事

1. **设置Vue实例的构造函数**：在`_init`函数的开始部分，会首先通过`vm._self = this`来设置Vue实例的构造函数。这样做的目的是让Vue实例能够访问到它的构造函数，从而在后续的过程中能够创建新的Vue实例。
2. **合并选项**：接下来，`_init`函数会合并用户传入的选项和Vue的默认选项。这些选项包括Vue实例的数据、方法、生命周期钩子等。合并选项的目的是保证Vue实例有完整的配置，同时也允许用户根据需要覆盖默认配置。
3. **初始化生命周期**：在Vue中，生命周期钩子函数是非常重要的部分，它们允许在Vue实例的不同生命周期阶段执行特定的逻辑。因此，在`_init`函数中，会初始化这些生命周期钩子函数。
4. **初始化事件系统**：Vue有自己的事件系统，它允许在Vue实例内部或者组件之间进行事件通信。在`_init`函数中，会初始化这个事件系统。
5. **初始化渲染系统**：如果Vue实例有`render`函数或者`template`选项，那么`_init`函数会初始化Vue的渲染系统。这个渲染系统负责把Vue实例的状态转换成实际的DOM结构。
6. **调用`beforeCreate`和`created`生命周期钩子**：在所有的初始化工作完成之后，`_init`函数会调用`beforeCreate`和`created`生命周期钩子。在这两个钩子函数中，用户可以执行一些初始化的逻辑，比如设置初始状态、发起网络请求等。

> 1. initLifecycle(vm): 这个函数用于初始化Vue实例的生命周期。它设置了实例的一些关键属性，如$parent、$root等，同时也为实例设置了生命周期的钩子函数。
> 2. initEvents(vm): 这个函数用于初始化Vue实例的事件系统。事件系统是Vue实例内部组件间通信的重要机制，此函数将为实例创建事件中心，并提供$on，$once，$off，$emit等事件相关的方法。
> 3. initRender(vm): 这个函数用于初始化Vue实例的渲染系统。它主要进行Vue的渲染相关功能的初始化，比如设置实例的$slots、$scopedSlots等。
> 4. callHook(vm, 'beforeCreate'): 在实例的beforeCreate生命周期阶段，调用用户定义的beforeCreate钩子函数。
> 5. initInjections(vm): 这个函数在数据/props解析之前解析注入，用于解决依赖注入的问题。
> 6. initState(vm): 这个函数用于初始化Vue实例的状态，包括props、methods、data、computed等属性。这是一个核心步骤，因为它涉及到响应式系统的建立，即如何跟踪和响应数据的变化。
> 7. initProvide(vm): 这个函数在数据/props解析之后解析提供者（provide），解决依赖注入的问题。
> 8. callHook(vm, 'created'): 在实例的created生命周期阶段，调用用户定义的created钩子函数。至此，Vue实例的初始化工作基本完成，可以进行数据的观测和模板的编译/挂载等操作。

在初始化的最后，会判断是否存在`el`属性，如果存在则调用 `vm.$mount` 方法挂载 `vm`，挂载的目标是把模板渲染成DOM

## 调试Vue源码

在package.json中开启sourcemap，方便在浏览器调试源代，可以关联到对应的源码文件

`dev": "rollup -w -c scripts/config.js --environment TARGET:web-full-dev --sourcemap`

执行`npm run dev` 可以看到`dist/vue.js`中下有`vue.js.map`

![image-20231112125850584](E:\typoraFile\img\image-20231112125850584.png)

在`example`中新建`02.compiler版本Vue体验/index.html`

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport"
        content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>Document</title>
</head>
<body>
<div id="app">
  {{ message }}
</div>
<!-- 引入完整版Vue 也就是runtime-with-compiler版本  -->
<script src="../../dist/vue.js"></script>
<script>
  debugger
  var app = new Vue({
    el: "#app",
    data: {
      message: "Hello Vue!"
    }
  });
</script>
</body>
</html>
```

启动html文件，可以在浏览器控制台中看到映射的源代码

![image-20231112130647390](E:\typoraFile\img\image-20231112130647390.png)

>如果没有看到src，重新按照以下步骤运行：npm run build -> npm run dev -> 调试index.html

**案例**

以`entry-runtime-with-compiler`为例，如何调试`_init`的源码？

断电执行到new Vue时，进入到Vue构造函数中

![image-20231112142126279](E:\typoraFile\img\image-20231112142126279.png)

![image-20231112142214079](E:\typoraFile\img\image-20231112142214079.png)

这样就成功定位到`_init`源码了，可以愉快的debugger了

## 挂载Vue实例

Vue通过`$mount`方法挂载`vm`的，`$mount`的实现和平台、构建方式有关(为了实现跨平台)。以`entry-runtime-with-compiler`版本的`$mount`为例(抛开了webpack的vue-loader的影响)：

首先缓存原型上的$mount方法

`const mount = Vue.prototype.$mount`

再重新定义该方法，新的`$mount`方法对 el 做了限制，Vue 不能挂载在 body、html 这样的根节点上。之后读取options配置，如果没有定义render方法，则会通过`compileToFunctions`把template或el标识的字符串，转换成`render`方法，这个过程是 Vue 的一个“在线编译”的过程，`compileToFunctions`之后会介绍。最后，调用原先缓存的 `mount ` 方法进行挂载。

```javascript
// 1.首先缓存原型上的$mount方法
const mount = Vue.prototype.$mount
// 2.再重新定义$mount
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  // 获取el节点
  el = el && query(el)
  /* istanbul ignore if */
  // 对 el 做了限制，Vue 不能挂载在 body、html 这样的根节点上
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  /*
  * 这部分逻辑很关键，如果没有render方法，就将template/el标识的字符串，通过compileToFunctions转换为render方法
  * */
  const options = this.$options
  // resolve template/el and convert to render function
  if (!options.render) {
    let template = options.template
    if (template) {
      if (typeof template === 'string') {
        if (template.charAt(0) === '#') {
          // 获取配置中的
          template = idToTemplate(template)
          debugger
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        // nodeType属性以数字形式返回指定节点的节点类型
        //  1：元素节点
        //  2：属性节点
        //  3：文本节点
        // ...
        //  8：注释节点
        template = template.innerHTML
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      template = getOuterHTML(el)
    }
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        delimiters: options.delimiters,
        comments: options.comments
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  // 最后调用缓存的mount方法，进行挂载
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML (el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}
// ...
Vue.compile = compileToFunctions

export default Vue
```

**注意：**在vue2中，所有的组件渲染最终都需要render方法，无论是单文件组件的写法还是通过new Vue的写法

> 为什么要先缓存$mount呢？
>
> 通过代码追踪可以发现，原先的$mount是在`src/platform/web/runtime/index.js`中定义的，之所以这么做是为了复用，该方法可以被runtime Only版本的Vue直接复用，因为runtime Only版本是通过vue-loader 等工具把 .vue 文件编译成 JavaScript，所以省去了在线编译的阶段，可以直接挂载

`src/platform/web/runtime/index.js`

```js
// public mount method
// el可以是DOM也可以是字符串，可以通过query方法转换成DOM对象
// 第二个参数是服务端渲染相关的，可以先不考虑
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && inBrowser ? query(el) : undefined
  return mountComponent(this, el, hydrating)
}
```

可以看到，`$mount`的核心就是调用了`mountComponent `方法，该方法定义在`src/core/instance/lifecycle.js`中

核心逻辑就是，首先执行`beforeMount`钩子，然后实例化一个`watcher`，在它的回调中执行`updateComponent`，该方法中主要通过`vm._render()`生成虚拟节点`vnode`，然后通过`vm._render`更新DOM。

> `Watcher` 在这里起到两个作用，一个是初始化的时候会执行回调函数，另一个是当 vm 实例中的监测的数据发生变化的时候执行回调函数。并且如果已经挂载，则会在`updateComponent`之前先执行`beforeUpdate`钩子

`mountComponent`函数最后会判断`vm._$vnode == null` 是否为真，是则手动调用 `callHook(vm, 'mounted')`（一般只有根组件的 `vm.$vnode` 为空，所以这第四步只有根组件的 `$mount` 里会走到）

> vm.$vnode标识Vue实例的父虚拟节点，所有当它为null时，表示当前是根Vue的实例
>
> 参考：[链接](https://coding.imooc.com/learn/questiondetail/86530.html#:~:text=%E9%82%A3%E4%B9%88%E5%9C%A8%E7%88%B6%E7%BB%84%E4%BB%B6%E4%B8%AD%EF%BC%8Cchild%20%E5%B0%B1%E6%98%AF%E4%B8%80%E4%B8%AA%E7%BB%84%E4%BB%B6%20vnode%EF%BC%8C%E5%AE%83%E4%BC%9A%E5%9C%A8%20patch%20%E8%BF%87%E7%A8%8B%E4%B8%AD%E6%89%A7%E8%A1%8C%20child%20%E7%BB%84%E4%BB%B6%E7%9A%84%E5%88%9D%E5%A7%8B%E5%8C%96%EF%BC%8C%E5%90%8C%E6%97%B6%E6%8A%8A%E8%BF%99%E4%B8%AA%20vnode,vm._vnode%EF%BC%8C_vnode%20%E4%BD%A0%E5%8F%AF%E4%BB%A5%E7%90%86%E8%A7%A3%E4%B8%BA%E7%BB%84%E4%BB%B6%E7%9A%84%E6%B8%B2%E6%9F%93%20root%20vnode%EF%BC%8C%E8%80%8C%20%24vnode%20%E5%B0%B1%E6%98%AF%20_parentVnode%EF%BC%8C%E6%98%AF%E8%BF%99%E4%B8%AA%E7%BB%84%E4%BB%B6%E5%9C%A8%E7%88%B6%E7%BB%84%E4%BB%B6%E4%B8%AD%E7%9A%84%E5%8D%A0%E4%BD%8D%E7%BB%84%E4%BB%B6%20vnode%EF%BC%8C%E6%89%80%E4%BB%A5%E8%AF%B4%E6%98%AF%E7%88%B6%E5%AD%90%E5%85%B3%E7%B3%BB%E4%B9%9F%E4%B8%8D%E4%B8%BA%E8%BF%87%E3%80%82)

`mountComponent`完成整个渲染工作，其中核心的两个方法为`_render`和`_update`

## render函数

指的是`vm._render`，该方法是Vue实例的一个私有方法，用于将Vue实例渲染为虚拟节点。

`src/core/instance/render.js`：

```javascript
Vue.prototype._render = function (): VNode {
  const vm: Component = this
  const { render, _parentVnode } = vm.$options

  if (_parentVnode) {
    vm.$scopedSlots = normalizeScopedSlots(
      _parentVnode.data.scopedSlots,
      vm.$slots,
      vm.$scopedSlots
    )
  }

  // 设置父vnode。这允许render函数访问占位符节点上的数据。
  vm.$vnode = _parentVnode
  // render self
  let vnode
  try {
    // 由于所有渲染函数都是单独调用的，因此无需维护堆栈。当父组件patched时，将会调用嵌套组件的render函数。
    currentRenderingInstance = vm
    // 核心就是调用了render方法
    vnode = render.call(vm._renderProxy, vm.$createElement)
  } catch (e) {
    handleError(e, vm, `render`)
    // 返回错误的渲染结果，或先前的vnode以防止渲染错误导致空白组件
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production' && vm.$options.renderError) {
      try {
        vnode = vm.$options.renderError.call(vm._renderProxy, vm.$createElement, e)
      } catch (e) {
        handleError(e, vm, `renderError`)
        vnode = vm._vnode
      }
    } else {
      vnode = vm._vnode
    }
  } finally {
    currentRenderingInstance = null
  }
  // 允许返回的数组中只包含一个节点
  if (Array.isArray(vnode) && vnode.length === 1) {
    vnode = vnode[0]
  }
  // 如果渲染出错，返回空节点
  if (!(vnode instanceof VNode)) {
    if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) {
      warn(
        'Multiple root nodes returned from render function. Render function ' +
        'should return a single root node.',
        vm
      )
    }
    vnode = createEmptyVNode()
  }
  // set parent
  vnode.parent = _parentVnode
  return vnode
}
```

该代码块，最关键的是`render`方法的调用，在之前的`mounted`过程中，会把`template`编译成`render`方法，这个过程比较复杂，后面细看。

关于`render`函数，官网有详细介绍：[render](https://v2.cn.vuejs.org/v2/api/#render)、[渲染函数 & JSX](https://v2.cn.vuejs.org/v2/guide/render-function.html)

> render：(createElement: () => VNode) => VNode
>
> render函数第一个参数为`createElement`方法，返回一个`VNode`。
>
> Vue 选项中的 `render` 函数若存在，则 Vue 构造函数不会从 `template` 选项或通过 `el` 选项指定的挂载元素中提取出的 HTML 模板编译渲染函数。
>
> 因此
>
> ```javascript
> <div id="app">
> {{ message }}
> </div>
> ```
>
> 相当于
>
> ```javascript
> render: function (createElement) {
> return createElement('div', {
>   attrs: {
>      id: 'app'
>    },
> }, this.message)
> }
> ```

`_render`中的调用了`render`方法

```javascript
vnode = render.call(vm._renderProxy, vm.$createElement)
```

可以看到`render`函数中的形参`createElement`其实就是`vm.$createElement`实现的。该方法定义在`src/core/instance/render.js`的`initRender`中

```javascript
export function initRender (vm: Component) {
  // ...
  // bind the createElement fn to this instance
  // so that we get proper render context inside it.
  // args order: tag, data, children, normalizationType, alwaysNormalize
  // internal version is used by render functions compiled from templates
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
  // normalization is always applied for the public version, used in
  // user-written render functions.
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)
  // ...
}
```

`vm._c`，是被模板编译成的`render`函数使用

`vm.$createElement`是用户手写的`render`函数

这两个方法支持的参数相同，且内部都调用`createElement`生成`VNode`

**总结**

`vm.render`最终是通过`createElement`方法返回`VNode`，也就是**Virtual DOM**，它会告诉 Vue 页面上需要渲染什么样的节点，包括及其子节点的描述信息。Vue 通过建立一个**虚拟 DOM** 来追踪自己要如何改变真实 DOM

## Virtual DOM

Virtual DOM 就是用一个原生的 JS 对象去描述一个 DOM 节点。

**为什么需要虚拟DOM？**

操作`DOM`的代价仍旧是昂贵的，频繁操作还是会出现页面卡顿，影响用户的体验。

用传统的原生`api`或`jQuery`去操作`DOM`时，浏览器会从构建`DOM`树开始从头到尾执行一遍流程。例如，需要更新10个`DOM`节点，浏览器最终会执行10次流程；而通过`VNode`，同样更新10个`DOM`节点，虚拟`DOM`不会立即操作`DOM`，而是将这10次更新的`diff`内容保存到本地的一个`js`对象中，最终将这个`js`对象一次性`attach`到`DOM`树上，减少DOM操作

> 虚拟DOM的特点并不在于提高了渲染性能，因为毕竟还多了一步转化的过程，真正的优势提供了一个抽象层，实现了跨平台的特性

源码定义在：`src/core/vdom/vnode.js`

```javascript
export default class VNode {
  tag: string | void;
  data: VNodeData | void;
  children: ?Array<VNode>;
  text: string | void;
  elm: Node | void;
  ns: string | void;
  context: Component | void; // rendered in this component's scope
  key: string | number | void;
  componentOptions: VNodeComponentOptions | void;
  componentInstance: Component | void; // component instance
  parent: VNode | void; // component placeholder node

  // strictly internal
  raw: boolean; // contains raw HTML? (server only)
  isStatic: boolean; // hoisted static node
  isRootInsert: boolean; // necessary for enter transition check
  isComment: boolean; // empty comment placeholder?
  isCloned: boolean; // is a cloned node?
  isOnce: boolean; // is a v-once node?
  asyncFactory: Function | void; // async component factory function
  asyncMeta: Object | void;
  isAsyncPlaceholder: boolean;
  ssrContext: Object | void;
  fnContext: Component | void; // real context vm for functional nodes
  fnOptions: ?ComponentOptions; // for SSR caching
  devtoolsMeta: ?Object; // used to store functional render context for devtools
  fnScopeId: ?string; // functional scope id support

  constructor (
    tag?: string,
    data?: VNodeData,
    children?: ?Array<VNode>,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions,
    asyncFactory?: Function
  ) {
    this.tag = tag
    this.data = data
    this.children = children
    this.text = text
    this.elm = elm
    this.ns = undefined
    this.context = context
    this.fnContext = undefined
    this.fnOptions = undefined
    this.fnScopeId = undefined
    this.key = data && data.key
    this.componentOptions = componentOptions
    this.componentInstance = undefined
    this.parent = undefined
    this.raw = false
    this.isStatic = false
    this.isRootInsert = true
    this.isComment = false
    this.isCloned = false
    this.isOnce = false
    this.asyncFactory = asyncFactory
    this.asyncMeta = undefined
    this.isAsyncPlaceholder = false
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  get child (): Component | void {
    return this.componentInstance
  }
}
```

对`VNode`简单说明：

- 所有实例对象的`context`选项都指向Vue实例

- ele属性指向其对应的真实DOM

```javascript
/*当前节点的标签名*/
this.tag = tag
/*当前节点对应的对象，包含了具体的一些数据信息，是一个VNodeData类型，可以参考VNodeData类型中的数据信息*/
this.data = data
/*当前节点的子节点，是一个数组*/
this.children = children
/*当前节点的文本*/
this.text = text
/*当前虚拟节点对应的真实dom节点*/
this.elm = elm
/*当前节点的名字空间*/
this.ns = undefined
/*编译作用域*/
this.context = context
/*函数化组件作用域*/
this.functionalContext = undefined
/*节点的key属性，被当作节点的标志，用以优化*/
this.key = data && data.key
/*组件的option选项*/
this.componentOptions = componentOptions
/*当前节点对应的组件的实例*/
this.componentInstance = undefined
/*当前节点的父节点*/
this.parent = undefined
/*简而言之就是是否为原生HTML或只是普通文本，innerHTML的时候为true，textContent的时候为false*/
this.raw = false
/*静态节点标志*/
this.isStatic = false
/*是否作为跟节点插入*/
this.isRootInsert = true
/*是否为注释节点*/
this.isComment = false
/*是否为克隆节点*/
this.isCloned = false
/*是否有v-once指令*/
this.isOnce = false
```

>Vue.js 中 Virtual DOM 是借鉴了一个开源库 [snabbdom](https://github.com/snabbdom/snabbdom) 的实现，然后加入了一些 Vue.js 的东西。可以看看这个库的源码，它更加简单和纯粹。

**总结**

VNode 是对真实 DOM 的一种抽象描述，只是用来映射到真实DOM的渲染。核心定义聚焦于几个关键属性，标签名、数据、子节点、键值等，其它属性都是用来扩展 VNode 的灵活性以及实现一些feature 的

Virtual DOM 除了数据结构的定义，映射真实DOM要经历VNode的create、diff、patch等过程。VNode的create是通过`createElement` 方法创建的。

## createElement

定义在`src/core/vdom/create-element.js`：

`createElement`其实是一个包装器，对形参做了一层处理，然后调用真正创建`VNode`的函数`_createElement`

```javascript
export function createElement (
  context: Component,
  tag: any,
  data: any,
  children: any,
  normalizationType: any,
  alwaysNormalize: boolean
): VNode | Array<VNode> {
  if (Array.isArray(data) || isPrimitive(data)) {
    normalizationType = children
    children = data
    data = undefined
  }
  if (isTrue(alwaysNormalize)) {
    normalizationType = ALWAYS_NORMALIZE
  }
  return _createElement(context, tag, data, children, normalizationType)
}
```

1. `context`：组件实例上下文，即当前组件的实例。
2. `tag`：要创建的元素的标签名或组件的构造函数。
3. `data`：包含了一些元素的属性信息，比如 class、style 等。可以在 `flow/vnode.js` 中找到它的定义
4. `children`：子节点，可以是一个数组，包含了当前节点的子节点。
5. `normalizationType`：用于确定子节点的规范化方式，是一个标志位。它主要是参考 `render` 函数是编译生成的还是用户手写的。
6. `alwaysNormalize`：一个布尔值，表示是否始终进行规范化。


