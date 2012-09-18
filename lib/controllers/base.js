var ejs  = require('ejs'),
    fs   = require('fs'),
    qs   = require('querystring'),
    url  = require('url'),
    util = require('util');

var viewDir = __dirname + '/../views/';

var Controller = function(request, response) {
  this.request  = request;
  this.response = response;
  
  var contentType = (request.headers['content-type'] || '').split(/\s*;\s*/)[0];
  
  if (contentType === 'application/x-www-form-urlencoded')
    this.params = qs.parse(request.body);
  else
    this.params = url.parse(request.url, true).query;
};

Controller.prototype.blockUnsecureRequest = function() {
  if (this.request.secure || !this._forceSSL) return false;
  this.response.writeHead(400, {});
  this.response.end();
  return true;
};

Controller.prototype.redirectToSSL = function() {
  if (this.request.secure || !this._forceSSL) return false;
  this.response.writeHead(302, {
    Location: 'https://' + this.request.headers.host + this.request.url
  });
  this.response.end();
  return true;
};

Controller.prototype.renderXRD = function(file, locals) {
  var response = this.response;
  fs.readFile(viewDir + file, function(error, xml) {
    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/xrd+xml'
    });
    response.write(ejs.render(xml.toString(), {locals: locals || {}}));
    response.end();
  });
};

Controller.prototype.renderJSON = function(file, locals) {
  var response = this.response;
  fs.readFile(viewDir + file, function(error, json) {
    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    });
    response.write(ejs.render(json.toString(), {locals: locals || {}}));
    response.end();
  });
};

Controller.prototype.renderHTML = function(status, file, locals) {
  var response = this.response;
  fs.readFile(viewDir + file, function(error, html) {
    response.writeHead(status, {'Content-Type': 'text/html'});
    response.write(ejs.render(html.toString(), {locals: locals || {}}));
    response.end();
  });
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

