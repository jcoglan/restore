#!/usr/bin/env node

const conf_example = 
`{
  // allow new user to register !
  allow_signup: false
  storage_path: '/home/les/remoteStorage',
  cache_views: true,
  http: {
    port: 8000
  },
  
  https: {
    enable: true,
    force: true,
    port: 4443,
    cert: '/etc/ssl/server.crt',
    key: '/etc/ssl/server.key'
  }
}`

const reStore = require('../lib/restore')
const path = require('path')

var remoteStorageServer = {

  parseArgs () {
    const ArgumentParser = require('argparse').ArgumentParser
    const parser = new ArgumentParser({
      version: '1.0.0',
      addHelp: true,
      description: 'NodeJS remoteStorage server'
    })

    parser.addArgument (['-C','--cert'], 
      { help: `ssl certificate (${__dirname}/ssl/server.crt)`, 
      default: __dirname + '/ssl/server.crt'})
    
    parser.addArgument (['-K','--key'], 
      { help: `ssl certificate (${__dirname}/ssl/server.key)`, 
      default: __dirname + '/ssl/server.key'})

    parser.addArgument(['-p','--path'], {
      help: 'path used to store user\'s data',
      default: 'remoteStorageData'
    })

    parser.addArgument(['-c','--conf'], {
      help: 'configuration file (use -j to create an example)'
    })

    parser.addArgument(['-j','--conf-example'], {
      help: 'print out a configuration example',
      action: 'storeTrue'
    })

    return parser.parseArgs()
  },

  checkConf (conf) {

  },

  init () {
    const args = this.parseArgs()
    let conf = {}

    if (args.conf_example) {
      console.log(conf_example)
      return
    }

    if (args.conf) {
      try {
        conf = require(path.join(__dirname, args.conf))
      } catch(e) {
        console.error(`[ERROR] Reading '${args.conf}'`)
        return     
      }
    }
    
    console.log(`[INFO] Starting remoteStorage engine:
    http://${conf.http.host}:${conf.http.port}!`)

    process.umask(077)
    const store = new reStore.FileTree({path: conf.storage_path});
    const server = new reStore({
      store,
      http: {
        host: conf.http.host,
        port: conf.http.port
      },
      https: {
        host: conf.https.host,
        port: conf.https.port,
        force: conf.https.force,
        cert: conf.https.cert,
        key: conf.https.key
      },
      allow: {
        signup: conf.allow_signup
      },
      cacheViews: conf.cache_views
    })


    server.boot();
  }
}

if (require.main === module) {
  remoteStorageServer.init()
}


