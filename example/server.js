var reStore = require('../lib/restore'),
    store,
    server,
    fs = require('fs');

var type = process.argv[2];

if (type === 'redis')
  store = new reStore.Redis({database: 3});
else
  store = new reStore.FileTree({path: __dirname + '/tree'});

server = new reStore({
  store:  store,
  http:   {port: 80},
  https:  {
    force:  true,
    port:   443,
    certText:   fs.readFileSync(__dirname + '/ssl/server.crt'),
    keyText:    fs.readFileSync(__dirname + '/ssl/server.key'),
    caText:   fs.readFileSync(__dirname + '/ssl/chain.ca')
  },
  allow: {
    signup: true
  },
  cacheViews: false
});

server.boot();

