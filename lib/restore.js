var domain = require('domain'),
    fs     = require('fs'),
    http   = require('http'),
    https  = require('https'),
    url    = require('url'),
    RemotestorageServer = require('remotestorage-server');

var Assets    = require('./controllers/assets'),
    OAuth     = require('./controllers/oauth'),
    Storage   = require('./controllers/storage'),
    Users     = require('./controllers/users'),
    WebFinger = require('./controllers/web_finger');

var SSL_CIPHERS = 'ECDHE-RSA-AES256-SHA384:AES256-SHA256:RC4-SHA:RC4:HIGH:!MD5:!aNULL:!EDH:!AESGCM',
    SSL_OPTIONS = require('constants').SSL_OP_CIPHER_SERVER_PREFERENCE;

var Restore = function(options) {
  this._options    = options;
  this._store      = options.store;
  this._forceSSL   = options.https && options.https.force;
  this._fileCache  = {};
  this._allow      = options.allow || {};
  this._cacheViews = options.cacheViews !== false;

  var self = this;
  this.remotestorageServer = new RemotestorageServer('draft-dejong-remotestorage-01', {
    get: function(username, key, cb) {
      self._store.queryToken(username, key, cb);
    }
  }, {
    get: function(username, key, cb) {
      self._store.getItem(username, key, cb);
    },
    set: function(username, key, value, cb) {
    if(!Buffer.isBuffer(value) && value !== undefined) {
      throw new Error('non-buffer set!');
    }
      if (value === undefined) {
        self._store.deleteItem(username, key, cb);
      } else {
        self._store.putItem(username, key, value, cb);
      }
    }
  }); 

  var handler = function(request, response) {
    var d = domain.create();
    d.add(request);
    d.add(response);

    d.on('error', function(error) {
      if (process.env.DEBUG) console.log(error);
      new Assets(self, request, response).errorPage(500, error.message);
    });

    d.run(function() { self.handle(request, response) });
  };

  if (this._options.http)
    this._httpServer = http.createServer(handler);
  
  if (this._options.https && this._options.https.port) {
    var sslOptions = {
      key:           fs.readFileSync(this._options.https.key),
      cert:          fs.readFileSync(this._options.https.cert),
      ciphers:       SSL_CIPHERS,
      secureOptions: SSL_OPTIONS
    };
    if(this._options.https.ca)
      sslOptions.ca = fs.readFileSync(this._options.https.ca);

    this._httpsServer = https.createServer(sslOptions, handler);
  }
};

Restore.prototype.boot = function() {
  if (this._httpServer) this._httpServer.listen(this._options.http.port);
  if (this._httpsServer) this._httpsServer.listen(this._options.https.port);
};

Restore.prototype.stop = function() {
  if (this._httpServer) this._httpServer.close();
  if (this._httpsServer) this._httpsServer.close();
};

Restore.prototype.getStoragePort = function() {
  try {
    if (this._httpsServer)
      return this._options.https.port;
    return this._options.http.port;
  } catch(e) {
  }
};

Restore.prototype.handle = function(request, response) {
  var self, body;
  
  if (process.env.DEBUG) console.log(request.method, request.url, request.headers);
 
  if (request.method === 'POST') {
    self = this;
    body = new Buffer(0);
    request.on('data', function(chunk) {
      var buffer = new Buffer(body.length + chunk.length);
      body.copy(buffer);
      chunk.copy(buffer, body.length);
      body = buffer;
    });

    request.on('end', function() {
      request.buffer = body;
      request.body = body.toString('utf8');
      self.dispatch(request, response);
    });
  } else {
    this.dispatch(request, response);
  }
};

Restore.prototype.dispatch = function(request, response) {
  var method = request.method.toUpperCase(),
      uri    = url.parse(request.url, true),
      match  = null;

  request.secure = this.isSecureRequest(request);

  if (/(^|\/)\.\.(\/|$)/.test(uri.pathname)) {
    response.writeHead(400, {'Access-Control-Allow-Origin': '*'});
    return response.end();
  }

  if (method === 'GET' && uri.pathname === '/')
    return new Assets(this, request, response).renderHTML(200, 'index.html', {title: 'reStore'});

  match = uri.pathname.match(/^\/assets\/([^\/]+)$/);
  if (method === 'GET' && match)
    return new Assets(this, request, response).serve(match[1]);

  match = uri.pathname.match(/^\/\.well-known\/host-meta(\.[a-z]+)?$/);
  if (method === 'GET' && match)
    return new WebFinger(this, request, response).hostMeta(match[1]);

  match = uri.pathname.match(/^\/webfinger\/(jrd|xrd)$/);
  if (method === 'GET' && match)
    return new WebFinger(this, request, response).account(match[1]);

  match = uri.pathname.match(/^\/\.well-known\/webfinger?(.*)$/);
  if (method === 'GET' && match)
    return new WebFinger(this, request, response).rfc7033(match[1]);

  match = uri.pathname.match(/^\/\.well-known\/webfinger?(.*)$/);
  match = uri.pathname.match(/^\/oauth\/(.*)$/);
  if (method === 'GET' && match)
    return new OAuth(this, request, response).showForm(decodeURIComponent(match[1]));

  if (method === 'POST' && uri.pathname === '/oauth')
    return new OAuth(this, request, response).authenticate();

  if (uri.pathname === '/signup') {
    var users = new Users(this, request, response);
    if (method === 'GET') return users.showForm();
    if (method === 'POST') return users.register();
  }

  match = uri.pathname.match(/^\/storage\/([^\/]+)(.*)$/);
  if (match) {
    var username = decodeURIComponent(match[1]).split('@')[0],
        path     = match[2],
        storage  = new Storage(this, request, response, username, path);

    if (!Storage.VALID_NAME.test(username) || !Storage.VALID_PATH.test(path)) {
      response.writeHead(400, {'Access-Control-Allow-Origin': '*'});
      return response.end();
    }
    return this.remotestorageServer.storage(request, response);
  }

  new Assets(this, request, response).errorPage(404, 'Not found');
};

Restore.prototype.isSecureRequest = function(r) {
  return (r.connection && r.connection.authorized !== undefined)
      || (r.socket && r.socket.secure)
      || (r.headers['x-forwarded-ssl'] === 'on')
      || (r.headers['x-forwarded-scheme'] === 'https')
      || (r.headers['x-forwarded-proto'] === 'https');
};

module.exports = Restore;
module.exports.FileTree = require('./stores/file_tree');
module.exports.Redis = require('./stores/redis');

