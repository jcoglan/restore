var OAuth = require('./base').inherit(function(forceSSL, store) {
  this._forceSSL = forceSSL;
  this._store    = store;
});

OAuth.action('createUser', function() {
  var self = this;
  if (this.blockUnsecureRequest()) return;
  
  this._store.createUser(this.params, function(error) {
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
  if (this.redirectToSSL()) return;
  
  this.renderHTML(200, 'auth.html', {
    client_id:      this.params.client_id,
    redirect_uri:   this.params.redirect_uri,
    response_type:  this.params.response_type,
    scope:          this.params.scope || '',
    state:          this.params.state || '',
    username:       username,
    scheme:         this.request.secure ? 'https' : 'http',
    access_strings: this.accessStrings
  });
});

OAuth.action('authenticate', function() {
  if (this.blockUnsecureRequest()) return;
  
  var params      = this.params,
      username    = params.username.split('@')[0],
      permissions = this.parseScope(params.scope),
      self        = this;
  
  this._store.authenticate({username: username, password: params.password}, function(error) {
    if (error) {
      params.error = error.message;
      params.access_strings = self.accessStrings;
      params.scheme = self.request.secure ? 'https' : 'http';
      self.renderHTML(401, 'auth.html', params);
    } else {
      self._store.authorize(params.client_id, username, permissions, function(error, token) {
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

