var ejs  = require('ejs'),
    fs   = require('fs'),
    qs   = require('querystring'),
    url  = require('url'),
    util = require('util');

var viewDir = __dirname + '/../views/';

var Controller = function(request, response) {
  this.request    = request;
  this.response   = response;
  this._callbacks = [];
  
  var body        = '',
      contentType = (request.headers['content-type'] || '').split(/\s*;\s*/)[0],
      self        = this;
  
  request.setEncoding('utf8');
  request.addListener('data', function(chunk) { body += chunk });
  request.addListener('end', function() {
    request.body = body;
    if (contentType === 'application/x-www-form-urlencoded')
      self.params = qs.parse(body);
    else
      self.params = url.parse(request.url, true).query;
    
    for (var i = 0, n = self._callbacks.length; i < n; i++)
      self._callbacks[i][0].call(self._callbacks[i][1]);
  });
};

Controller.prototype.callback = function(callback, context) {
  this._callbacks.push([callback, context]);
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
    this.prototype[name] = function() {
      var args = arguments;
      this.callback(function() { method.apply(this, args) }, this);
    };
  };
  return klass;
};

module.exports = Controller;

