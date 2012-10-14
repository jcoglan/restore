var crypto = require('crypto'),
    core   = require('../stores/core');

var Storage = require('./base').inherit(function(store, username, path) {
  this._store    = store;
  this._username = username;
  this._path     = path;
  
  if (this.request.headers.authorization)
    this._token = decodeURIComponent(this.request.headers.authorization).split(/\s+/)[1];
  else
    this._token = this.params.oauth_token;
  
  this._headers = {
    'Access-Control-Allow-Origin':  this.request.headers.origin || '*',
    'Cache-Control':                'no-cache, no-store'
  };
});

Storage.action('options', function() {
  this._headers['Access-Control-Allow-Methods'] = 'GET, PUT, DELETE';
  this._headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Length, Content-Type, Origin, X-Requested-With';
  this.response.writeHead(200, this._headers);
  this.response.end();
});

Storage.action('get', function() {
  var ims  = this.request.headers['if-modified-since'],
      inm  = this.request.headers['if-none-match'],
      self = this;
  
  this.checkToken('r', function() {
    self._store.get(self._username, self._path, function(error, item) {
      var status = error ? 500 : item ? 200 : 404,
          etag;
      
      if (item instanceof Array) {
        var listing = {}, n = item.length;
        while (n--) listing[item[n].name] = item[n].modified.getTime();
        self._headers['Content-Type'] = 'application/json';
        item.value = JSON.stringify(listing, true, 2);
      }
      else if (item) {
        etag = crypto.createHash('md5').update(item.value).digest('hex');
        self._headers['Content-Type']  = item.type || 'text/plain';
        self._headers['ETag'] = etag;
        self._headers['Last-Modified'] = item.modified.toGMTString();
      }
      
      if (error) item = {value: error.message};
      
      if ((inm && inm === etag) || (ims && item && new Date(ims) < item.modified)) {
        self._headers['Content-Length'] = 0;
        self.response.writeHead(304, self._headers);
        self.response.end();
      } else {
        if (item) self._headers['Content-Length'] = item.value.length;
        self.response.writeHead(status, self._headers);
        if (item) self.response.write(item.value);
        self.response.end();
      }
    });
  });
});

Storage.action('put', function() {
  var value = this.request.buffer,
      type  = (this.request.headers['content-type'] || '').split(/\s*;\s*/)[0],
      self  = this;
  
  this.checkToken('w', function() {
    self._store.put(self._username, self._path, type, value, function(error, created, modified) {
      var status = error ? 500 : created ? 201 : 200;
      if (modified) self._headers['Last-Modified'] = modified.toGMTString();
      if (error) self._headers['Content-Length'] = new Buffer(error.message).length;
      self.response.writeHead(status, self._headers);
      self.response.end(error ? error.message : '');
    });
  });
});

Storage.action('delete', function() {
  var self = this;
  
  this.checkToken('w', function() {
    self._store.delete(self._username, self._path, function(error, deleted) {
      var status = error ? 500 : deleted ? 200 : 404;
      if (error) self._headers['Content-Length'] = new Buffer(error.message).length;
      self.response.writeHead(status, self._headers);
      self.response.end(error ? error.message : '');
    });
  });
});

Storage.prototype.checkToken = function(permission, callback) {
  var category = this._path.replace(/^\/public\//, '/'),
      parents  = core.parents(category, true),
      isdir    = /\/$/.test(this._path),
      public   = /^\/public\//.test(this._path),
      self     = this;
  
  if (permission === 'r' && public && !isdir) return callback();
  
  this._store.clientForToken(self._username, self._token, function(error, clientId) {
    if (error) return self.unauthorized(401, 'invalid_token');
    
    self._store.authorizations(self._username, function(error, authorizations) {
      var permissions = authorizations[clientId], dir;
      if (!permissions) return self.unauthorized(401, 'invalid_token');
      
      for (var i = 0, n = parents.length; i < n; i++) {
        dir = permissions[parents[i]];
        if (!dir || dir.indexOf(permission) < 0) continue;
        
        if (permission === 'w' && isdir) {
          self.response.writeHead(200, self._headers);
          return self.response.end();
        } else {
          return callback();
        }
      }
      self.unauthorized(403, 'insufficient_scope');
    });
  });
};

Storage.prototype.unauthorized = function(status, error) {
  var realm = this.request.headers.host;
  this._headers['WWW-Authenticate'] = 'Bearer realm="' + realm + '" error="' + error + '"'
  this.response.writeHead(status, this._headers);
  this.response.end();
};

module.exports = Storage;

