process.umask(077);
process.env.DEBUG = true;

var reStore = require('./lib/restore'),
    store   = new reStore.FileTree({path: '/data/restore/storage'}),
    userName = 'michiel',
    certpath = '/tls/michielbdejong.com';

store.getItem(userName, 'content:'+certpath+'/tls.key', function(err1, key) {
  store.getItem(userName, 'content:'+certpath+'/tls.cert', function(err2, cert) {
    store.getItem(userName, 'content:'+certpath+'/chain.pem', function(err3, chain) {
      console.log(err1, err2, err3);
      server  = new reStore({
        store:  store,
//        allow: {
//          signup: true
//        },
        https:   {
          port: 8000,
          keyText: key,
          certText: cert,
          caText: chain
        }
      });
      server.boot();
    });
  });
});

