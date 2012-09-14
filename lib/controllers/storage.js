var crypto = require('crypto');

var Storage = require('./base').inherit(function(store, username, category, key) {
  this._store    = store;
  this._username = username;
  this._category = category;
  this._key      = key;
  
  if (this.request.headers.authorization)
    this._token = decodeURIComponent(this.request.headers.authorization).split(/\s+/)[1];
  else
    this.callback(function() { this._token = this.params.oauth_token }, this);
  
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
  
  self._store.get(self._token, self._username, self._category, self._key, function(error, item) {
    var status = error ? error.status : item ? 200 : 404,
        etag;
    
    if (item instanceof Array) {
      var listing = {}, n = item.length;
      while (n--) listing[item[n].name] = item[n].modified.getTime();
      self._headers['Content-Type'] = 'application/json';
      item.value = JSON.stringify(listing, true, 2);
    } else if (item) {
      etag = crypto.createHash('md5').update(item.value).digest('hex');
      self._headers['Content-Type']  = item.type || 'text/plain';
      self._headers['ETag'] = etag;
      self._headers['Last-Modified'] = item.modified.toGMTString();
    }
    
    if ((inm && inm === etag) || (ims && item && new Date(ims) < item.modified)) {
      self._headers['Content-Length'] = 0;
      self.response.writeHead(304, self._headers);
      self.response.end();
    } else {
      if (item) self._headers['Content-Length'] = new Buffer(item.value).length;
      self.response.writeHead(status, self._headers);
      if (item) self.response.write(item.value);
      self.response.end();
    }
  });
});

Storage.action('put', function() {
  var value = this.request.body,
      type  = (this.request.headers['content-type'] || '').split(/\s*;\s*/)[0],
      self  = this;
  
  self._store.put(self._token, self._username, self._category, self._key, type, value, function(error, created, modified) {
    var status = error ? error.status : created ? 201 : 200;
    if (modified) self._headers['Last-Modified'] = modified.toGMTString();
    self.response.writeHead(status, self._headers);
    self.response.end();
  });
});

Storage.action('delete', function() {
  var self = this;
  
  self._store.delete(self._token, self._username, self._category, self._key, function(error, deleted) {
    var status = error ? error.status : deleted ? 200 : 404;
    self.response.writeHead(status, self._headers);
    self.response.end();
  });
});

module.exports = Storage;

