'use strict';

var domain = require('domain'),
    fs     = require('fs'),
    http   = require('http'),
    https  = require('https'),
    url    = require('url');

var Assets    = require('./controllers/assets'),
    OAuth     = require('./controllers/oauth'),
    Storage   = require('./controllers/storage'),
    Users     = require('./controllers/users'),
    WebFinger = require('./controllers/web_finger');

var DEFAULT_HOST = '0.0.0.0',
    SSL_CIPHERS  = 'ECDHE-RSA-AES256-SHA384:AES256-SHA256:RC4-SHA:RC4:HIGH:!MD5:!aNULL:!EDH:!AESGCM',
    SSL_OPTIONS  = require('constants').SSL_OP_CIPHER_SERVER_PREFERENCE;

var Restore = function(options) {
  this._options    = options;
  this._store      = options.store;
  this._forceSSL   = options.https && options.https.force;
  this._fileCache  = {};
  this._allow      = options.allow || {};
  this._cacheViews = options.cacheViews !== false;

  var self = this;

  var handler = function(request, response) {
    var d = domain.create();
    d.add(request);
    d.add(response);

    d.on('error', function(error) {
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
  if (this._httpServer)
    this._httpServer.listen(this._options.http.port, this._options.http.host || DEFAULT_HOST);

  if (this._httpsServer)
    this._httpsServer.listen(this._options.https.port, this._options.https.host || DEFAULT_HOST);
};

Restore.prototype.stop = function() {
  if (this._httpServer) this._httpServer.close();
  if (this._httpsServer) this._httpsServer.close();
};

Restore.prototype.handle = function(request, response) {
  if (process.env.DEBUG) console.log(request.method, request.url, request.headers);

  var body = new Buffer(0),
      self = this;

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
};

Restore.prototype.dispatch = function(request, response) {
  var method = request.method.toUpperCase(),
      uri    = url.parse(request.url, true),
      match  = null;

  request.secure = this.isSecureRequest(request);

  if (/(^|\/)\.\.(\/|$)/.test(uri.pathname)) {
    response.writeHead(400, {'Access-Control-Allow-Origin': request.headers.origin || '*'});
    return response.end();
  }

  if (method === 'GET' && uri.pathname === '/')
    return new Assets(this, request, response).renderHTML(200, 'index.html', {title: 'reStore'});

  match = uri.pathname.match(/^\/assets\/([^\/]+)$/);
  if (method === 'GET' && match)
    return new Assets(this, request, response).serve(match[1]);

  match = uri.pathname.match(/^\/\.well-known\/(host-meta|webfinger)(\.[a-z]+)?$/);
  if (method === 'GET' && match)
    return new WebFinger(this, request, response).hostMeta(match[1], match[2]);

  match = uri.pathname.match(/^\/webfinger\/(jrd|xrd)$/);
  if (method === 'GET' && match)
    return new WebFinger(this, request, response).account(match[1]);

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
      response.writeHead(400, {'Access-Control-Allow-Origin': request.headers.origin || '*'});
      return response.end();
    }

    if (method === 'OPTIONS') return storage.options();
    if (method === 'GET')     return storage.get();
    if (method === 'PUT')     return storage.put();
    if (method === 'DELETE')  return storage.delete();
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
