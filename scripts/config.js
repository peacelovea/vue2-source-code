const path = require('path')
const buble = require('rollup-plugin-buble')
const alias = require('rollup-plugin-alias')
const cjs = require('rollup-plugin-commonjs')
const replace = require('rollup-plugin-replace')
const node = require('rollup-plugin-node-resolve')
const flow = require('rollup-plugin-flow-no-whitespace')
const version = process.env.VERSION || require('../package.json').version
const weexVersion = process.env.WEEX_VERSION || require('../packages/weex-vue-framework/package.json').version
const featureFlags = require('./feature-flags')

const banner =
  '/*!\n' +
  ` * Vue.js v${version}\n` +
  ` * (c) 2014-${new Date().getFullYear()} Evan You\n` +
  ' * Released under the MIT License.\n' +
  ' */'

const weexFactoryPlugin = {
  intro () {
    return 'module.exports = function weexFactory (exports, document) {'
  },
  outro () {
    return '}'
  }
}

const aliases = require('./alias')

/**
 *
 * @param p url
 * @returns {string} p在当前工作目录对应的绝对路径
 * @description 把参数p通过"/"做分割得到一个数组，首项设置为base，通过别名读取base，返回p在当前工作目录对应的绝对路径
 * @example  resolve('web/entry-runtime.js') -> 返回源码目录下的 src/platforms/web/entry-runtime.js
 */
const resolve = p => {
  const base = p.split('/')[0]
  // aliases[base]找到base在当前工作目录的绝对路径中的绝对路径
  if (aliases[base]) {
    return path.resolve(aliases[base], p.slice(base.length + 1))
  } else {
    return path.resolve(__dirname, '../', p)
  }
}

/**
 *
 * @type {{"web-full-prod": {entry: string, format: string, alias: {he: string}, banner: string, dest: string, env: string}, "web-server-renderer-basic": {entry: string, plugins: ({generateBundle: function(): void, name: string, options: function(*): void, resolveId: function(*, *): (null|string)}|{transform: function(*, *): (null|*), load: function(*): (string|string|undefined), name: string, options: function(*): void, resolveId: function(*, *): (*)})[], format: string, moduleName: string, dest: string, env: string}, "web-runtime-cjs-dev": {entry: string, format: string, banner: string, dest: string, env: string}, "weex-factory": {entry: string, weex: boolean, plugins: {intro(): string, outro(): string}[], format: string, dest: string}, "web-runtime-cjs-prod": {entry: string, format: string, banner: string, dest: string, env: string}, "web-full-esm-browser-prod": {entry: string, format: string, transpile: boolean, alias: {he: string}, banner: string, dest: string, env: string}, "web-server-renderer-dev": {entry: string, external: string[], format: string, dest: string, env: string}, "web-full-dev": {entry: string, format: string, alias: {he: string}, banner: string, dest: string, env: string}, "web-compiler-browser": {entry: string, plugins: ({generateBundle: function(): void, name: string, options: function(*): void, resolveId: function(*, *): (null|string)}|{transform: function(*, *): (null|*), load: function(*): (string|string|undefined), name: string, options: function(*): void, resolveId: function(*, *): (*)})[], format: string, moduleName: string, dest: string, env: string}, "web-runtime-dev": {entry: string, format: string, banner: string, dest: string, env: string}, "web-full-cjs-prod": {entry: string, format: string, alias: {he: string}, banner: string, dest: string, env: string}, "web-server-renderer-webpack-server-plugin": {entry: string, external: string[], format: string, dest: string}, "web-full-esm": {entry: string, format: string, alias: {he: string}, banner: string, dest: string}, "web-runtime-prod": {entry: string, format: string, banner: string, dest: string, env: string}, "web-server-renderer-webpack-client-plugin": {entry: string, external: string[], format: string, dest: string}, "web-full-cjs-dev": {entry: string, format: string, alias: {he: string}, banner: string, dest: string, env: string}, "web-compiler": {entry: string, external: string[], format: string, dest: string}, "web-server-renderer-prod": {entry: string, external: string[], format: string, dest: string, env: string}, "web-full-esm-browser-dev": {entry: string, format: string, transpile: boolean, alias: {he: string}, banner: string, dest: string, env: string}, "weex-framework": {entry: string, weex: boolean, format: string, dest: string}, "weex-compiler": {entry: string, external: string[], weex: boolean, format: string, dest: string}, "web-runtime-esm": {entry: string, format: string, banner: string, dest: string}}}
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
  'web-full-cjs-prod': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.common.prod.js'),
    format: 'cjs',
    env: 'production',
    alias: { he: './entity-decoder' },
    banner
  },
  // Runtime only ES modules build (for bundlers)
  'web-runtime-esm': {
    entry: resolve('web/entry-runtime.js'),
    dest: resolve('dist/vue.runtime.esm.js'),
    format: 'es',
    banner
  },
  // Runtime+compiler ES modules build (for bundlers)
  'web-full-esm': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.esm.js'),
    format: 'es',
    alias: { he: './entity-decoder' },
    banner
  },
  // Runtime+compiler ES modules build (for direct import in browser)
  'web-full-esm-browser-dev': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.esm.browser.js'),
    format: 'es',
    transpile: false,
    env: 'development',
    alias: { he: './entity-decoder' },
    banner
  },
  // Runtime+compiler ES modules build (for direct import in browser)
  'web-full-esm-browser-prod': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.esm.browser.min.js'),
    format: 'es',
    transpile: false,
    env: 'production',
    alias: { he: './entity-decoder' },
    banner
  },
  // runtime-only build (Browser)
  'web-runtime-dev': {
    entry: resolve('web/entry-runtime.js'),
    dest: resolve('dist/vue.runtime.js'),
    format: 'umd',
    env: 'development',
    banner
  },
  // runtime-only production build (Browser)
  'web-runtime-prod': {
    entry: resolve('web/entry-runtime.js'),
    dest: resolve('dist/vue.runtime.min.js'),
    format: 'umd',
    env: 'production',
    banner
  },
  // Runtime+compiler development build (Browser)
  'web-full-dev': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.js'),
    format: 'umd',
    env: 'development',
    alias: { he: './entity-decoder' },
    banner
  },
  // Runtime+compiler production build  (Browser)
  'web-full-prod': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.min.js'),
    format: 'umd',
    env: 'production',
    alias: { he: './entity-decoder' },
    banner
  },
  // Web compiler (CommonJS).
  'web-compiler': {
    entry: resolve('web/entry-compiler.js'),
    dest: resolve('packages/vue-template-compiler/build.js'),
    format: 'cjs',
    external: Object.keys(require('../packages/vue-template-compiler/package.json').dependencies)
  },
  // Web compiler (UMD for in-browser use).
  'web-compiler-browser': {
    entry: resolve('web/entry-compiler.js'),
    dest: resolve('packages/vue-template-compiler/browser.js'),
    format: 'umd',
    env: 'development',
    moduleName: 'VueTemplateCompiler',
    plugins: [node(), cjs()]
  },
  // Web server renderer (CommonJS).
  'web-server-renderer-dev': {
    entry: resolve('web/entry-server-renderer.js'),
    dest: resolve('packages/vue-server-renderer/build.dev.js'),
    format: 'cjs',
    env: 'development',
    external: Object.keys(require('../packages/vue-server-renderer/package.json').dependencies)
  },
  'web-server-renderer-prod': {
    entry: resolve('web/entry-server-renderer.js'),
    dest: resolve('packages/vue-server-renderer/build.prod.js'),
    format: 'cjs',
    env: 'production',
    external: Object.keys(require('../packages/vue-server-renderer/package.json').dependencies)
  },
  'web-server-renderer-basic': {
    entry: resolve('web/entry-server-basic-renderer.js'),
    dest: resolve('packages/vue-server-renderer/basic.js'),
    format: 'umd',
    env: 'development',
    moduleName: 'renderVueComponentToString',
    plugins: [node(), cjs()]
  },
  'web-server-renderer-webpack-server-plugin': {
    entry: resolve('server/webpack-plugin/server.js'),
    dest: resolve('packages/vue-server-renderer/server-plugin.js'),
    format: 'cjs',
    external: Object.keys(require('../packages/vue-server-renderer/package.json').dependencies)
  },
  'web-server-renderer-webpack-client-plugin': {
    entry: resolve('server/webpack-plugin/client.js'),
    dest: resolve('packages/vue-server-renderer/client-plugin.js'),
    format: 'cjs',
    external: Object.keys(require('../packages/vue-server-renderer/package.json').dependencies)
  },
  // Weex runtime factory
  'weex-factory': {
    weex: true,
    entry: resolve('weex/entry-runtime-factory.js'),
    dest: resolve('packages/weex-vue-framework/factory.js'),
    format: 'cjs',
    plugins: [weexFactoryPlugin]
  },
  // Weex runtime framework (CommonJS).
  'weex-framework': {
    weex: true,
    entry: resolve('weex/entry-framework.js'),
    dest: resolve('packages/weex-vue-framework/index.js'),
    format: 'cjs'
  },
  // Weex compiler (CommonJS). Used by Weex's Webpack loader.
  'weex-compiler': {
    weex: true,
    entry: resolve('weex/entry-compiler.js'),
    dest: resolve('packages/weex-template-compiler/build.js'),
    format: 'cjs',
    external: Object.keys(require('../packages/weex-template-compiler/package.json').dependencies)
  }
}

function genConfig (name) {
  const opts = builds[name]
  const config = {
    input: opts.entry,
    external: opts.external,
    plugins: [
      flow(),
      alias(Object.assign({}, aliases, opts.alias))
    ].concat(opts.plugins || []),
    output: {
      file: opts.dest,
      format: opts.format,
      banner: opts.banner,
      name: opts.moduleName || 'Vue'
    },
    onwarn: (msg, warn) => {
      if (!/Circular/.test(msg)) {
        warn(msg)
      }
    }
  }

  // built-in vars
  const vars = {
    __WEEX__: !!opts.weex,
    __WEEX_VERSION__: weexVersion,
    __VERSION__: version
  }
  // feature flags
  Object.keys(featureFlags).forEach(key => {
    vars[`process.env.${key}`] = featureFlags[key]
  })
  // build-specific env
  if (opts.env) {
    vars['process.env.NODE_ENV'] = JSON.stringify(opts.env)
  }
  config.plugins.push(replace(vars))

  if (opts.transpile !== false) {
    config.plugins.push(buble())
  }

  Object.defineProperty(config, '_name', {
    enumerable: false,
    value: name
  })

  return config
}

if (process.env.TARGET) {
  module.exports = genConfig(process.env.TARGET)
} else {
  exports.getBuild = genConfig
  exports.getAllBuilds = () => Object.keys(builds).map(genConfig)
}
