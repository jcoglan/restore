var reStore = require('../lib/restore'),
    store   = new reStore.File(__dirname + '/store'),
    server  = new reStore({store: store});

server.listen(process.argv[2]);

