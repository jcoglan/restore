var reStore = require('../lib/restore'),
    store,
    server;

var type = process.argv[3];

if (type === 'redis')
  store = new reStore.Redis({database: 3});
else if (type === 'tree')
  store = new reStore.FileTree({path: __dirname + '/tree'});
else
  store = new reStore.File({path: __dirname + '/store'});

server = new reStore({
  store:  store,
  http:   {port: 80},
  https:  {
    force:  true,
    port:   443,
    key:    __dirname + '/../spec/ssl/server.key',
    cert:   __dirname + '/../spec/ssl/server.crt'
  }
});

server.boot();

