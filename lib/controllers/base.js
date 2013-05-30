var ejs  = require('ejs'),
    ent  = require('ent'),
    fs   = require('fs'),
    qs   = require('querystring'),
    url  = require('url'),
    util = require('util'),
    core = require('../stores/core');

var viewDir = __dirname + '/../views/';

var Controller = function(request, response) {
  this.request  = request;
  this.response = response;

  this._fileCache  = {};
  this._cacheViews = false;

  var contentType = (request.headers['content-type'] || '').split(/\s*;\s*/)[0];

  if (contentType === 'application/x-www-form-urlencoded')
    this.params = qs.parse(request.body);
  else
    this.params = url.parse(request.url, true).query;
};

Controller.prototype.blockUnsecureRequest = function() {
  if (this.request.secure || !this._forceSSL) return false;
  this.response.writeHead(400, {
    'Strict-Transport-Security': 'max-age=86400'
  });
  this.response.end();
  return true;
};

Controller.prototype.redirectToSSL = function() {
  if (this.request.secure || !this._forceSSL) return false;
  this.response.writeHead(302, {
    'Location': 'https://' + this.request.headers.host + this.request.url,
    'Strict-Transport-Security': 'max-age=86400'
  });
  this.response.end();
  return true;
};

Controller.prototype.invalidUser = function(username) {
  if (core.VALID_NAME.test(username)) return false;
  this.response.writeHead(400, {'Content-Type': 'text/plan'});
  this.response.end();
  return true;
};

Controller.prototype.readFile = function(path) {
  if (this._fileCache[path]) return this._fileCache[path];
  try {
    var content = fs.readFileSync(path);
    if (this._cacheViews) this._fileCache[path] = content;
    return content;
  } catch (e) {
    return null;
  }
};

Controller.prototype.renderXRD = function(file, locals) {
  var response = this.response;
      template = this.readFile(viewDir + file);

  locals = locals || {};

  response.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/xrd+xml'
  });
  response.write(ejs.render(template.toString(), {locals: locals}));
  response.end();
};

Controller.prototype.renderJSON = function(data) {
  this.response.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  });
  this.response.write(JSON.stringify(data, true, 2));
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
    host:   headers['x-forwarded-host'] || headers['host'] || '',
    title:  locals.title || ''
  };

  response.writeHead(status, {'Content-Type': 'text/html'});
  globals.body = ejs.render(body.toString(), {locals: locals});
  response.end(ejs.render(layout.toString(), {locals: globals}));
};

Controller.inherit = function(constructor) {
  var klass = function(request, response) {
    Controller.call(this, request, response);
    if (constructor) constructor.apply(this, Array.prototype.slice.call(arguments, 2));
  };
  util.inherits(klass, Controller);

  klass.action = function(name, method) {
    this.prototype[name] = method;
  };
  return klass;
};

module.exports = Controller;

