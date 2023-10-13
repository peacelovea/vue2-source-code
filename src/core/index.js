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
