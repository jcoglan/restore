var fs    = require('fs'),
    http  = require('http'),
    https = require('https'),
    url   = require('url');

var WebFinger = require('./controllers/web_finger'),
    OAuth     = require('./controllers/oauth'),
    Storage   = require('./controllers/storage');

var Restore = function(options) {
  this._options  = options || {};
  this._store    = options.store;
  this._forceSSL = options.https && options.https.force;

  var self = this;

  if (this._options.http)
    this._httpServer = http.createServer(function(request, response) {
      self.handle(request, response);
    });

  if (this._options.https && this._options.https.port)
    this._httpsServer = https.createServer({
      key:  fs.readFileSync(this._options.https.key),
      cert: fs.readFileSync(this._options.https.cert)
    }, function(request, response) {
      self.handle(request, response);
    });
};

Restore.VALID_PATH = /^\/[a-z0-9\%\-\_\/]*$/i;

Restore.prototype.boot = function() {
  if (this._httpServer) this._httpServer.listen(this._options.http.port);
  if (this._httpsServer) this._httpsServer.listen(this._options.https.port);
};

Restore.prototype.stop = function() {
  if (this._httpServer) this._httpServer.close();
  if (this._httpsServer) this._httpsServer.close();
};

Restore.prototype.handle = function(request, response) {
  if (!process.env.SILENT) console.log(request.method, request.url);

  var body = new Buffer(0),
      self = this;

  request.addListener('data', function(chunk) {
    var buffer = new Buffer(body.length + chunk.length);
    body.copy(buffer);
    chunk.copy(buffer, body.length);
    body = buffer;
  });

  request.addListener('end', function() {
    request.buffer = body;
    request.body = body.toString('utf8');
    self.dispatch(request, response);
  });
};

Restore.prototype.dispatch = function(request, response) {
  var method = request.method.toLowerCase(),
      uri    = url.parse(request.url, true),
      match  = null;

  request.secure = this.isSecureRequest(request);

  if (method === 'get' && uri.pathname === '/') {
    response.writeHead(200, {'Content-Type': 'text/html'});
    return response.end('Welcome to reStore');
  }

  match = uri.pathname.match(/^\/\.well-known\/host-meta(\..*)?$/);
  if (method === 'get' && match)
    return new WebFinger(request, response, this._forceSSL).hostMeta(match[1]);

  match = match = uri.pathname.match(/^\/webfinger\/(jrd|xrd)\/acct:(.*)$/);
  if (method === 'get' && match)
    return new WebFinger(request, response, this._forceSSL).account(match[1], decodeURIComponent(match[2]));

  match = uri.pathname.match(/^\/oauth\/(.*)$/);
  if (method === 'get' && match)
    return new OAuth(request, response, this._forceSSL, this._store).showForm(decodeURIComponent(match[1]));

  if (method === 'post' && uri.pathname === '/oauth')
    return new OAuth(request, response, this._forceSSL, this._store).authenticate();

  if (method === 'post' && uri.pathname === '/users')
    return new OAuth(request, response, this._forceSSL, this._store).createUser();

  match = match = uri.pathname.match(/^\/storage\/([^\/]+)(\/.*)$/);
  if (match) {
    var username = decodeURIComponent(match[1]).split('@')[0],
        path     = match[2],
        storage  = new Storage(request, response, this._store, username, path);

    if (!Restore.VALID_PATH.test(path)) {
      response.writeHead(400, {'Access-Control-Allow-Origin': '*'});
      return response.end();
    }

    if (method === 'options') return storage.options();
    if (method === 'get')     return storage.get();
    if (method === 'put')     return storage.put();
    if (method === 'delete')  return storage.delete();
  }

  response.writeHead(404, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'text/plain'
  });
  response.write('Not found');
  response.end();
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

