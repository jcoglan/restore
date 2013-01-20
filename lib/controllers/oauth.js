var qs  = require('querystring'),
    url = require('url');

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

  if (!this.params.client_id)     return this.error('invalid_request');
  if (!this.params.redirect_uri)  return this.error('invalid_request');
  if (!this.params.response_type) return this.error('invalid_request');
  if (!this.params.scope)         return this.error('invalid_scope');

  if (this.params.response_type !== 'token')
    return this.error('unsupported_response_type');

  this.renderHTML(200, 'auth.html', {
    client_host:    url.parse(this.params.redirect_uri).host,
    client_id:      this.params.client_id,
    redirect_uri:   this.params.redirect_uri,
    response_type:  this.params.response_type,
    scope:          this.params.scope || '',
    state:          this.params.state || '',
    permissions:    this.parseScope(this.params.scope || ''),
    username:       username,
    scheme:         this.request.secure ? 'https' : 'http',
    host:           this.getHost(),
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
      params.client_host    = url.parse(self.params.redirect_uri).host;
      params.error          = error.message;
      params.permissions    = permissions;
      params.access_strings = self.accessStrings;
      params.scheme         = self.request.secure ? 'https' : 'http';
      params.host           = self.getHost();

      self.renderHTML(401, 'auth.html', params);
    } else {
      self._store.authorize(params.client_id, username, permissions, function(error, token) {
        var args = {
          access_token: token,
          token_type:   'bearer',
        };
        if (params.state !== undefined) args.state = params.state;
        self.redirect(args);
      });
    }
  });
});

OAuth.prototype.error = function(type) {
  this.redirect({error: type});
};

OAuth.prototype.redirect = function(args) {
  var hash = qs.stringify(args);
  if (this.params.redirect_uri) {
    this.response.writeHead(302, {Location: this.params.redirect_uri + '#' + hash});
    this.response.end();
  } else {
    this.response.writeHead(400, {'Content-Type': 'text/plain'});
    this.response.end(hash);
  }
};

OAuth.prototype.accessStrings = {r: 'Read', rw: 'Read/write'};

OAuth.prototype.parseScope = function(scope) {
  var parts  = scope.split(/\s+/),
      scopes = {},
      pieces;

  for (var i = 0, n = parts.length; i < n; i++) {
    pieces = parts[i].split(':');
    pieces[0] = pieces[0].replace(/(.)\/*$/, '$1');
    if (pieces[0] === 'root') pieces[0] = '/';

    scopes[pieces[0]] = (pieces.length > 1)
                      ? pieces.slice(1).join(':').split('')
                      : ['r', 'w'];
  }
  return scopes;
};

module.exports = OAuth;

