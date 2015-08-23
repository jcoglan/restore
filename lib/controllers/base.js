'use strict';

var ejs  = require('ejs'),
    fs   = require('fs'),
    qs   = require('querystring'),
    url  = require('url'),
    util = require('util'),
    core = require('../stores/core');

var viewDir = __dirname + '/../views/';

var Controller = function(server, request, response) {
  this.server   = server;
  this.request  = request;
  this.response = response;

  var contentType = (request.headers['content-type'] || '').split(/\s*;\s*/)[0];

  if (contentType === 'application/x-www-form-urlencoded')
    this.params = qs.parse(request.body);
  else
    this.params = url.parse(request.url, true).query || {};
};

Controller.prototype.blockUnsecureRequest = function() {
  if (this.request.secure || !this.server._forceSSL) return false;
  this.response.writeHead(400, {
    'Strict-Transport-Security': 'max-age=86400'
  });
  this.response.end();
  return true;
};

Controller.prototype.getHost = function() {
  return this.request.headers['x-forwarded-host'] || this.request.headers.host || '';
};

Controller.prototype.redirectToSSL = function() {
  if (this.request.secure || !this.server._forceSSL) return false;

  var host = this.getHost().split(':')[0],
      port = (this.server._options.https || {}).port;

  if (port) host += ':' + port;

  this.response.writeHead(302, {
    'Location': 'https://' + host + this.request.url,
    'Strict-Transport-Security': 'max-age=86400'
  });
  this.response.end();
  return true;
};

Controller.prototype.invalidUser = function(username) {
  if (core.isValidUsername(username)) return false;
  this.response.writeHead(400, {'Content-Type': 'text/plan'});
  this.response.end();
  return true;
};

Controller.prototype.readFile = function(path) {
  if (this.server._fileCache[path]) return this.server._fileCache[path];
  try {
    var content = fs.readFileSync(path);
    if (this.server._cacheViews) this.server._fileCache[path] = content;
    return content;
  } catch (e) {
    return null;
  }
};

Controller.prototype.renderXRD = function(file, locals) {
  var response = this.response,
      template = this.readFile(viewDir + file);

  locals = locals || {};
  var body = new Buffer(ejs.render(template.toString(), locals));

  response.writeHead(200, {
    'Access-Control-Allow-Origin': this.request.headers.origin || '*',
    'Content-Length':              body.length,
    'Content-Type':                'application/xrd+xml'
  });
  response.write(body);
  response.end();
};

Controller.prototype.renderJSON = function(data, contentType) {
  var body = new Buffer(JSON.stringify(data, true, 2));

  this.response.writeHead(200, {
    'Access-Control-Allow-Origin': this.request.headers.origin || '*',
    'Content-Length':              body.length,
    'Content-Type':                'application/' + contentType
  });
  this.response.write(body);
  this.response.end();
};

Controller.prototype.renderHTML = function(status, file, locals) {
  var response = this.response,
      headers  = this.request.headers,
      layout   = this.readFile(viewDir + '/layout.html'),
      body     = this.readFile(viewDir + file);

  locals = locals || {};

  var globals = {
    scheme: this.request.secure ? 'https' : 'http',
    host:   this.getHost(),
    title:  locals.title || '',
    signup: this.server._allow.signup,
    body:   ejs.render(body.toString(), locals)
  };
  var html = new Buffer(ejs.render(layout.toString(), globals));

  response.writeHead(status, {
    'Content-Length': html.length,
    'Content-Type': 'text/html'
  });
  response.end(html);
};

Controller.prototype.errorPage = function(status, message) {
  this.renderHTML(status, 'error.html', {status: status, message: message});
};

Controller.inherit = function(constructor) {
  var klass = function(server, request, response) {
    Controller.call(this, server, request, response);
    if (constructor) constructor.apply(this, Array.prototype.slice.call(arguments, 3));
  };
  util.inherits(klass, Controller);

  klass.action = function(name, method) {
    this.prototype[name] = method;
  };
  return klass;
};

module.exports = Controller;
