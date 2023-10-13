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
 *
 * 为什么不用ES6的Class ?
 *  可以看到后面有很多 xxxMixin 方法，都是把Vue构造函数作为形参使用，点进其方法实现可以看到都是给Vue的prototype上拓展一些方法。
 *  Vue 按功能把这些扩展分散到多个模块中去实现，而不是在一个模块里实现所有，这种方式是用 Class 难以实现的。方便代码的维护和管理
 *  退一步说，class关键字创建的函数不能通过call,bind,apply改变this指向，Funtion可以。且使用Class实现的话，其示例方法很容易和原型上的方法混淆。
 *  如：
 *    class A{
 *      constructor(options){}
 *      someFunction(){console.log('from prototype');}
 *    }
 *    A.prototype.someFunction=function(){console.log('from prototype');}
 *    let app = new M();
 *    app.someFunction()
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
