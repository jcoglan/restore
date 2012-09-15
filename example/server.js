var reStore = require('../lib/restore'),
    store,
    server;

if (process.argv[3] === 'redis')
  store = new reStore.Redis({database: 3});
else
  store = new reStore.File(__dirname + '/store');

server = new reStore({store: store});
server.listen(process.argv[2]);

