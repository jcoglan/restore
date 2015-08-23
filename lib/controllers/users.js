'use strict';

var Users = require('./base').inherit();

Users.action('showForm', function() {
  if (!this.server._allow.signup) return this.errorPage(403, 'Forbidden');
  if (this.redirectToSSL()) return;
  this.renderHTML(200, 'signup.html', {params: this.params, error: null});
});

Users.action('register', function() {
  if (!this.server._allow.signup) return this.errorPage(403, 'Forbidden');
  if (this.blockUnsecureRequest()) return;

  var self = this;

  this.server._store.createUser(this.params, function(error) {
    if (error)
      self.renderHTML(409, 'signup.html', {params: self.params, error: error});
    else
      self.renderHTML(201, 'signup-success.html', {params: self.params});
  });
});

module.exports = Users;
