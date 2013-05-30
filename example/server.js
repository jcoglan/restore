var reStore = require('../lib/restore'),
    store,
    server;

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
    key:    __dirname + '/../spec/ssl/server.key',
    cert:   __dirname + '/../spec/ssl/server.crt'
  },
  cacheViews: false
});

server.boot();

