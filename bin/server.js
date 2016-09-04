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
    var version = require(__dirname + '/../package.json').version
    var parser = new ArgumentParser({
      version: version,
      addHelp: true,
      description: 'NodeJS remoteStorage server / ' + version
    })

    parser.addArgument(['-c','--conf'], {
      help: 'Path to configuration',
    })

    parser.addArgument(['-e','--exampleConf'], {
      help: 'Print configuration example',
      action: 'storeTrue'
    })

    return parser.parseArgs()
  },

  init: function() {
    var args = this.parseArgs()
    var conf = {}

    if (args.exampleConf) {
      console.log(fs.readFileSync(__dirname + '/conf.example.json', 'utf8'))
      return -1
    }

    if (!args.conf) {
      console.error('[ERR] Configuration file needed (help with -h)')
      return -1
    }

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
      baseURL: conf.baseURL,
      store,
      http: {
        host: conf.http.host,
        port: conf.http.port
      },
      https: {
        host: conf.https.host,
        port: conf.https.enable && conf.https.port,
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


