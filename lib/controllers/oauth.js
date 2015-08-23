'use strict';

var qs  = require('querystring'),
    url = require('url');

var OAuth = require('./base').inherit();

OAuth.action('showForm', function(username) {
  if (this.redirectToSSL()) return;
  if (this.invalidUser(username)) return;
  if (this.invalidOAuthRequest()) return;

  this.renderHTML(200, 'auth.html', {
    title:          'Authorize',
    client_host:    url.parse(this.params.redirect_uri).host,
    client_id:      this.params.client_id,
    redirect_uri:   this.params.redirect_uri,
    response_type:  this.params.response_type,
    scope:          this.params.scope || '',
    state:          this.params.state || '',
    permissions:    this.parseScope(this.params.scope || ''),
    username:       username,
    access_strings: this.accessStrings
  });
});

OAuth.action('authenticate', function() {
  if (this.blockUnsecureRequest()) return;
  if (this.invalidUser(this.params.username)) return;
  if (this.invalidOAuthRequest()) return;

  var params      = this.params,
      username    = params.username.split('@')[0],
      permissions = this.parseScope(params.scope),
      self        = this;

  if (params.deny) return this.error('access_denied', 'The user did not grant permission');

  this.server._store.authenticate({username: username, password: params.password}, function(error) {
    if (error) {
      params.title          = 'Authorize';
      params.client_host    = url.parse(params.redirect_uri).host;
      params.error          = error.message;
      params.permissions    = permissions;
      params.access_strings = self.accessStrings;
      params.state          = params.state || '';

      self.renderHTML(401, 'auth.html', params);
    } else {
      self.server._store.authorize(params.client_id, username, permissions, function(error, token) {
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

OAuth.prototype.invalidOAuthRequest = function() {
  if (!this.params.client_id)     return this.error('invalid_request', 'Required parameter "client_id" is missing');
  if (!this.params.response_type) return this.error('invalid_request', 'Required parameter "response_type" is missing');
  if (!this.params.scope)         return this.error('invalid_scope',   'Parameter "scope" is invalid');

  if (!this.params.redirect_uri)  return this.error('invalid_request', 'Required parameter "redirect_uri" is missing');
  var uri = url.parse(this.params.redirect_uri);
  if (!uri.protocol || !uri.hostname) return this.error('invalid_request', 'Parameter "redirect_uri" must be a valid URL');

  if (this.params.response_type !== 'token')
    return this.error('unsupported_response_type', 'Response type "' + this.params.response_type + '" is not supported');

  return false;
};

OAuth.prototype.error = function(type, description) {
  this.redirect({error: type, error_description: description});
  return true;
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
