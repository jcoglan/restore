#!/usr/bin/env node

var reStore = require('../lib/restore')
var path = require('path')
var fs = require('fs')

var remoteStorageServer = {

  // read and return configuration file
  readConf: function(confPath) {
    return JSON.parse(fs.readFileSync(confPath, 'utf8'))
  },

  // parse cli args
  parseArgs: function() {
    var ArgumentParser = require('argparse').ArgumentParser
    var parser = new ArgumentParser({
      version: '1.0.0',
      addHelp: true,
      description: 'NodeJS remoteStorage server'
    })

    parser.addArgument(['-c','--conf'], {
      help: 'Path to configuration',
      required: true
    })

    return parser.parseArgs()
  },

  init: function() {
    const args = this.parseArgs()
    let conf = {}

    try {
      conf = this.readConf(args.conf)
    } catch(e) {
      console.error( e.toString() )
      return -1
    }
    
    console.log('[INFO] Starting remoteStorage: http://' + conf.http.host + ':' + conf.http.port)

    process.umask(077)
    var store = new reStore.FileTree({path: conf.storage_path});
    var server = new reStore({
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


