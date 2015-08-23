'use strict';

var core = require('../stores/core');

var Storage = require('./base').inherit(function(username, path) {
  this._username = username;
  this._path     = path;

  if (this.request.headers.authorization)
    this._token = decodeURIComponent(this.request.headers.authorization).split(/\s+/)[1];
  else
    this._token = this.params.access_token || this.params.oauth_token;

  this._headers = {
    'Access-Control-Allow-Origin':   this.request.headers.origin || '*',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Type, ETag',
    'Cache-Control':                 'no-cache, no-store'
  };
});

Storage.VALID_PATH = core.VALID_PATH;
Storage.VALID_NAME = core.VALID_NAME;

Storage.action('options', function() {
  this._headers['Access-Control-Allow-Methods']  = 'OPTIONS, GET, HEAD, PUT, DELETE';
  this._headers['Access-Control-Allow-Headers']  = 'Authorization, Content-Length, Content-Type, If-Match, If-None-Match, Origin, X-Requested-With';
  this.response.writeHead(200, this._headers);
  this.response.end();
});

Storage.action('get', function() {
  var version = this.getVersion(),
      self    = this;

  this.checkToken('r', function() {
    self.server._store.get(self._username, self._path, version, function(error, item, versionMatch) {
      var status = error ? 500
                 : item  ? 200
                         : 404;

      if (item && item.children) {
        var listing = {}, n = item.children.length;
        while (n--) listing[item.children[n].name] = item.children[n].modified.toString();
        self._headers['Content-Type'] = 'application/json';
        item.value = JSON.stringify(listing, true, 2);
      }
      else if (item) {
        self._headers['Content-Type'] = item.type || 'text/plain';
      }

      self.setVersion(item && item.modified);
      if (error) item = {value: error.message};

      if (versionMatch) {
        delete self._headers['Content-Type'];
        self.response.writeHead(304, self._headers);
        return self.response.end();
      }

      if (item) self._headers['Content-Length'] = item.value.length;
      self.response.writeHead(status, self._headers);
      if (item) self.response.write(item.value);
      self.response.end();
    });
  });
});

Storage.action('put', function() {
  var value   = this.request.buffer,
      type    = this.request.headers['content-type'] || '',
      version = this.getVersion(),
      self    = this;

  this.checkToken('w', function() {
    self.server._store.put(self._username, self._path, type, value, version, function(error, created, modified, conflict) {
      var status = error    ? 500
                 : conflict ? 412
                 : created  ? 201
                            : 200;

      self.setVersion(modified);
      if (error) self._headers['Content-Length'] = new Buffer(error.message).length;
      self.response.writeHead(status, self._headers);
      self.response.end(error ? error.message : '');
    });
  });
});

Storage.action('delete', function() {
  var version = this.getVersion(),
      self    = this;

  this.checkToken('w', function() {
    self.server._store.delete(self._username, self._path, version, function(error, deleted, modified, conflict) {
      var status = error    ? 500
                 : deleted  ? 200
                 : conflict ? 412
                            : 404;

      self.setVersion(modified);
      if (error) self._headers['Content-Length'] = new Buffer(error.message).length;
      self.response.writeHead(status, self._headers);
      self.response.end(error ? error.message : '');
    });
  });
});

Storage.prototype.checkToken = function(permission, callback) {
  if (this.server._forceSSL && !this.request.secure) {
    this.server._store.revokeAccess(this._username, this._token);
    return this.unauthorized(400, 'invalid_request');
  }

  var category = this._path.replace(/^\/public\//, '/'),
      parents  = core.parents(category, true),
      isdir    = /\/$/.test(this._path),
      isPublic = /^\/public\//.test(this._path),
      self     = this;

  if (permission === 'r' && isPublic && !isdir) return callback();

  this.server._store.permissions(this._username, this._token, function(error, permissions) {
    if (!permissions) return self.unauthorized(401, 'invalid_token');
    var dir;

    for (var i = 0, n = parents.length; i < n; i++) {
      dir = permissions[parents[i]];
      if (!dir || dir.indexOf(permission) < 0) continue;

      if (permission === 'w' && isdir) {
        self.response.writeHead(400, self._headers);
        return self.response.end();
      } else {
        return callback();
      }
    }
    self.unauthorized(403, 'insufficient_scope');
  });
};

Storage.prototype.getVersion = function() {
  var headers = this.request.headers,
      ifMatch = headers['if-match'],
      ifNone  = headers['if-none-match'];

  if (ifMatch) return parseInt(ifMatch.match(/\d+/)[0], 10);
  if (ifNone)  return ifNone === '*' ? '*' : parseInt(ifNone.match(/\d+/)[0], 10);

  return null;
};

Storage.prototype.setVersion = function(timestamp) {
  if (!timestamp) return;
  this._headers['ETag'] = '"' + timestamp.toString() + '"';
};

Storage.prototype.unauthorized = function(status, error) {
  var realm = this.getHost();
  this._headers['WWW-Authenticate'] = 'Bearer realm="' + realm + '" error="' + error + '"';
  this.response.writeHead(status, this._headers);
  this.response.end();
};

module.exports = Storage;
