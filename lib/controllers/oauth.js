var OAuth = require('./base').inherit(function(store) {
  this._store = store;
});

OAuth.action('createUser', function() {
  var self = this;
  
  self._store.createUser(self.params, function(error) {
    if (error) {
      self.response.writeHead(409, {'Content-Type': 'text/html'});
      self.response.write('Error: ' + error.message);
      self.response.end();
    } else {
      self.response.writeHead(201, {'Content-Type': 'text/html'});
      self.response.write('Created');
      self.response.end();
    }
  });
});

OAuth.action('showForm', function(username) {
  this.renderHTML(200, 'auth.html', {
    client_id:      this.params.client_id,
    redirect_uri:   this.params.redirect_uri,
    response_type:  this.params.response_type,
    scope:          this.params.scope || '',
    state:          this.params.state || '',
    username:       username,
    access_strings: this.accessStrings
  });
});

OAuth.action('authenticate', function() {
  var params      = this.params,
      permissions = this.parseScope(params.scope),
      self        = this;
  
  this._store.authenticate(this.params, function(error) {
    if (error) {
      params.error = error.message;
      params.access_strings = self.accessStrings;
      self.renderHTML(401, 'auth.html', params);
    } else {
      self._store.authorize(params.client_id, params.username, permissions, function(error, token) {
        var hash = '#access_token=' + encodeURIComponent(token);
        if (params.state) hash += '&state=' + encodeURIComponent(params.state);
        self.response.writeHead(302, {Location: params.redirect_uri + hash});
        self.response.end();
      });
    }
  });
});

OAuth.prototype.accessStrings = {r: 'Read', rw: 'Read/write'};

OAuth.prototype.parseScope = function(scope) {
  var parts  = scope.split(/\s+/),
      n      = parts.length,
      scopes = {},
      pieces;
  
  while (n--) {
    pieces = parts[n].split(':');
    scopes[pieces[0]] = (pieces.length > 1)
                      ? pieces.slice(1).join(':').split('')
                      : ['r', 'w'];
  }
  return scopes;
};

module.exports = OAuth;

