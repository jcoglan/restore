var http = require('http'),
    url  = require('url');

var WebFinger = require('./controllers/web_finger'),
    OAuth     = require('./controllers/oauth'),
    Storage   = require('./controllers/storage');

var Restore = function(options) {
  this._store = options.store;
};

Restore.prototype.listen = function(port) {
  var self = this;
  this._server = http.createServer(function(request, response) {
    self.handle(request, response);
  });
  this._server.listen(port);
};

Restore.prototype.stop = function() {
  if (this._server) this._server.close();
  delete this._server;
};

Restore.prototype.handle = function(request, response) {
  if (!process.env.SILENT) console.log(request.method, request.url);
  
  var method = request.method.toLowerCase(),
      uri    = url.parse(request.url, true),
      match  = null;
  
  match = uri.pathname.match(/^\/\.well-known\/host-meta(\..*)?$/);
  if (method === 'get' && match)
    return new WebFinger(request, response).wellKnown(match[1]);
  
  match = match = uri.pathname.match(/^\/webfinger\/xrd\/acct:(.*)$/);
  if (method === 'get' && match)
    return new WebFinger(request, response).account(match[1]);
  
  match = uri.pathname.match(/^\/auth\/(.*)$/);
  if (method === 'get' && match)
    return new OAuth(request, response, this._store).showForm(match[1]);
  
  if (method === 'post' && uri.pathname === '/auth')
    return new OAuth(request, response, this._store).authenticate();
  
  if (method === 'post' && uri.pathname === '/users')
    return new OAuth(request, response, this._store).createUser();
  
  match = match = uri.pathname.match(/^\/data\/([^\/]+)(\/.*)$/);
  if (match) {
    var username = decodeURIComponent(match[1]),
        path     = decodeURIComponent(match[2]),
        
        storage  = new Storage(request, response, this._store, username, path);
    
    if (method === 'options') return storage.options();
    if (method === 'get')     return storage.get();
    if (method === 'put')     return storage.put();
    if (method === 'delete')  return storage.delete();
  }
  
  response.writeHead(404, {'Content-Type': 'text/plain'});
  response.write('Not found');
  response.end();
};

module.exports = Restore;
module.exports.File = require('./stores/file');
module.exports.Redis = require('./stores/redis');

