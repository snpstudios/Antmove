const path = require('path')
const fs = require('fs-extra')
const parser = require('./utils/parseXml')
const { ignoreFile } = require('./utils')
const { recordOptions } = require('./utils/getAntmoveConfigJs')

module.exports = {
  ...require('./Js'),
  ...require('./Json'),
  ...require('./Wxml'),
  ...require('./Wxss'),
  Application: {
    hook: 'before',
    body(node, store) {
      this.addChild({
        type: 'ReadCompileConfigJs',
      })
      recordOptions(store.config)
      const defaultExcludes = ['node_modules', 'antmove.config.js', 'project.config.json', '.DS_Store']
      store.excludes = defaultExcludes
      if (store.config.env === 'development') {
        store.repData = {}
        node.beginTime = Number(new Date())
        const types = {
          resDataInit: {},
          getSurrounding: {},
          getToolVs: {},
        }
        for (const t in types) {
          this.addChild({
            type: 'compilerLog',
            key: `compilerLog${t}`,
            body: {
              _type: t,
              opts: types[t],
            },
          })
        }
      }
    },
  },
  Directory(node, store) {
    const preData = store.config.preAppData
    const nodes = preData.nodes
    if (node.path === '.tea') {
      node.children = []
    }
    Object.keys(nodes).forEach((n, i) => {
      const _node = nodes[n]
      if (_node.dirPath === node.path) {
        const type = _node.type
        this.addChild({
          type,
          key: node.path + n,
          body: {
            dirpath: node.path,
            _node,
            _filePath: n,
          },
        })
      }
    })
  },
  File(node, store) {
    node.projectPath = path.relative(store.config.entry, node.path)
    if (node.extname) {
      if (node.extname === '.wxs') {
        this.addChild({
          type: 'Wxs',
          body: node,
        })
      }
      let extname = node.extname.replace(/^\./, '')
      extname = extname.replace(/^\w/, ($) => {
        1
        return $.toUpperCase()
      })
      const isDirxml = store.config.preAppData.nodes.hasOwnProperty(
        node.fullname,
      )
      this.$node.isDirxml = isDirxml
      if (!isDirxml) {
        this.addChild({
          ...node,
          type: extname,
          path: node.path,
          parent: node,
          children: [],
          body: {
            path: node.path,
            fullname: node.fullname,
          },
        })
      }
    }
    if (store.config.env === 'development') {
      store.repProject.fileNum++
    }
  },
  Page(node, store) {
    const { dirpath, _node, _filePath } = node.body
    const typeArr = ['Js', 'Wxml', 'Json', 'Wxss', 'Wxs']
    typeArr.forEach((t) => {
      const filePath = path.join(
        store.config.entry,
        `${_node.projectPath}.${t.toLowerCase()}`,
      )
      if (fs.pathExistsSync(filePath)) {
        const distArr = (`${_node.projectPath}.${t.toLowerCase()}`).split('/')
        if (ignoreFile(distArr, store.excludes)) {
          return
        }
        this.addChild({
          type: `Page${t}`,
          key: dirpath + _filePath + t,
          body: {
            dirpath,
            _node,
          },
        })
      }
    })
    if (store.config.env === 'development') {
      store.repProject.pageNum++
    }
  },
  Component(node, store) {
    const { dirpath, _node } = node.body
    const typeArr = ['Js', 'Wxml', 'Json', 'Wxss', 'Wxs']
    typeArr.forEach((t) => {
      const filePath = path.join(
        store.config.entry,
        `${_node.projectPath}.${t.toLowerCase()}`,
      )
      if (fs.pathExistsSync(filePath)) {
        const distArr = (`${_node.projectPath}.${t.toLowerCase()}`).split('/')
        if (ignoreFile(distArr, store.excludes)) {
          return
        }
        this.addChild({
          type: `Component${t}`,
          key: dirpath + t,
          body: {
            dirpath,
            _node,
          },
        })
      }
    })
    if (store.config.env === 'development') {
      store.repProject.componentNum++
    }
  },

  Js(node, store) {
    if (node.filename === 'app.js' && node.deep === 0) {
      this.addChild({
        type: 'AppJs',
        key: `${node.path}AppJs`,
        body: node,
      })
    }
    this.$node.content = fs.readFileSync(node.path, 'utf8')
    this.$node.projectPath = node.projectPath
    this.$node.dist = node.dist
    this.$node.originCode = this.$node.content
    this.addChild({
      type: 'ProcessBabel',
      key: `${node.parent.path}ProcessBabel`,
      path: node.path,
      body: node.parent,
      dist: node.dist,
    })
  },
  Json(node, store) {
    if (node.deep === 0 && node.filename === 'app.json') {
      this.addChild({
        type: 'AppJson',
        body: {
          path: node.path,
          dist: node.dist,
        },
      })
    }
    if (node.filename === 'package.json' && node.deep === 0) {
      store.package = JSON.parse(fs.readFileSync(node.path))
      this.addChild({
        type: 'PackageJson',
        body: {
          dist: node.dist,
        },
      })
    }
  },
  Wxss(node, store) {
    if (node.filename === 'app.wxss' && node.deep === 0) {
      this.addChild({
        type: 'AppWxss',
        body: node,
      })
    }
    this.$node.content = fs.readFileSync(node.path, 'utf8')
    this.$node.dist = node.dist
    this.$node.projectPath = node.projectPath
    this.addChild({
      type: 'ProcessCss',
      key: `${node.path}ProcessCss`,
      dist: node.dist,
      body: node,
    })
  },
  Wxs() {},
  Wxml(node, store) {
    const xmlType = store.config.preAppData.config.ex.xml
    const xmlAst = parser.parseFile(node.path)
    this.$node.content = ''
    this.$node.dist = node.dist.replace(/\.wxml$/, xmlType)
    this.$node.nodeId = 0
    this.addChild({
      type: 'processXmlAst',
      body: {
        ast: xmlAst,
        num: 0,
        deep: 1,
        projectPath: node.fullname,
        isInit: true,
      },
    })
    if (store.config.env === 'development') {
      this.addChild({
        type: 'compilerLog',
        body: {
          _type: 'getTemplateData',
          opts: {
            fileInfo: {
              path: node.path,
              ast: xmlAst,
            },
          },
        },
      })
    }
  },
  WxmlMounted() {
    this.addChild({
      type: 'outputFile',
      body: {
        dist: this.$node.dist,
        content: this.$node.content,
      },
    })
  },
  outputFile(node, store) {
    const body = node.body
    if (!body) {
      return false
    }
    const { dist, content } = body
    if (!dist || !content) {
      return false
    }
    const excludes = store.excludes
    const distArr = dist.replace(store.config.output, '').split('/')
    if (ignoreFile(distArr, excludes)) {
      return false
    }
    fs.outputFileSync(dist, content)
  },
  FileMounted(node, store) {
    const excludes = store.excludes
    const distArr = node.dist.replace(store.config.output, '').split('/')
    if (ignoreFile(distArr, excludes)) {
      return false
    }
    if (!this.$node.content && !this.$node.isDirxml) {
      this.addChild({
        type: 'compilerLog',
        body: {
          _type: 'getOthersFile',
          opts: {
            url: node.projectPath,
          },
        },
      })
      fs.copy(node.path, node.dist, (err) => {
        if (err) { throw err }
      })
    }
  },
}
