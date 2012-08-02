var http = require('http'),
    fs   = require('fs'),
    qs   = require('querystring'),
    url  = require('url'),
    ejs  = require('ejs');

var extend = function(destination, source) {
  for (var key in source) {
    destination[key] = source[key];
  }
  return destination;
};

var Restore = function(options) {
  this._store = options.store;
};

Restore.prototype.accessStrings = {r: 'Read', rw: 'Read/write'};

Restore.prototype.listen = function(port) {
  var self = this;
  this._server = http.createServer(function(request, response) {
    self.handle(request, response);
  });
  this._server.listen(port);
};

Restore.prototype.stop = function() {
  if (this._server) this._server.close();
  delete this._server;
};

Restore.prototype.handle = function(request, response) {
  if (!process.env.SILENT) console.log(request.method, request.url);
  
  var method = request.method.toLowerCase(),
      uri    = url.parse(request.url, true),
      match  = null,
      locals = null,
      user   = null,
      self   = this;
  
  match = uri.pathname.match(/^\/\.well-known\/host-meta(\..*)?$/);
  if (method === 'get' && match) {
    if (match[1] === '.json') {
      user = uri.query.resource.replace(/^acct:/, '').split('@')[0];
      return this.renderJSON(response, 'host-meta.json', {
        storage_url:  'http://localhost/data/' + user,
        auth_url:     'http://localhost/auth/' + user
      });
    } else {
      return this.renderXRD(response, 'host-meta.xml', {
        template_url: 'http://localhost/webfinger/xrd/{uri}'
      });
    }
  }
  
  match = uri.pathname.match(/^\/webfinger\/acct:(.*)$/);
  if (method === 'get' && match)
    return this.renderXRD(response, 'acct.xml', {
      auth_url:     'http://localhost/auth/' + match[1],
      template_url: 'http://localhost/data/' + match[1] + '/{category}'
    });
  
  match = uri.pathname.match(/^\/auth\/(.*)$/);
  if (method === 'get' && match)
    return this.renderHTML(response, 200, 'auth.html', {
      client_id:      uri.query.client_id,
      redirect_uri:   uri.query.redirect_uri,
      response_type:  uri.query.response_type,
      scope:          uri.query.scope || '',
      state:          uri.query.state || '',
      username:       match[1],
      access_strings: this.accessStrings
    });
  
  if (method === 'post' && uri.pathname === '/auth')
    return this.parseBody(request, function(error, params) {
      self._store.authenticate(params, function(error) {
        if (error) {
          params.error = error.message;
          params.access_strings = self.accessStrings;
          self.renderHTML(response, 401, 'auth.html', params);
        } else {
          self._store.authorize(params.client_id, params.username, params.scope, function(error, token) {
            var hash = '#access_token=' + encodeURIComponent(token);
            if (params.state) hash += '&state=' + encodeURIComponent(params.state);
            response.writeHead(302, {Location: params.redirect_uri + hash});
            response.end();
          });
        }
      });
    });
  
  if (method === 'post' && uri.pathname === '/users')
    return this.parseBody(request, function(error, params) {
      self._store.createUser(params, function(error) {
        if (error) {
          response.writeHead(409, {'Content-Type': 'text/html'});
          response.write('Error: ' + error.message);
          response.end();
        } else {
          response.writeHead(201, {'Content-Type': 'text/html'});
          response.write('Created');
          response.end();
        }
      });
    });
  
  match = uri.pathname.match(/^\/data\/([^\/]+)\/([^\/]+)\/([^\/]+)$/);
  if (match) {
    var token    = decodeURIComponent(request.headers.authorization || '').split(/\s+/).slice(1).join(' '),
        username = decodeURIComponent(match[1]),
        category = decodeURIComponent(match[2]),
        key      = decodeURIComponent(match[3]);
    
    var headers = {
      'Access-Control-Allow-Origin':  request.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Authorization, Content-Length, Content-Type, Origin, X-Requested-With',
      'Cache-Control':                'no-cache, no-store',
      'Content-Type':                 'text/plain'
    };
    
    if (method === 'options') {
      response.writeHead(200, headers);
      return response.end();
    }
    if (method === 'get')
      return this._store.get(token, username, category, key, function(error, value) {
        response.writeHead(error ? 401 : (value ? 200 : 404), headers);
        if (value) response.write(value);
        response.end();
      });
    
    if (method === 'put')
      return this.parseBody(request, function(error, value) {
        self._store.put(token, username, category, key, value, function(error) {
          response.writeHead(error ? 401 : 204, headers);
          response.end();
        });
      });
    
    if (method === 'delete')
      return this._store.delete(token, username, category, key, function(error) {
        response.writeHead(error ? 401 : 204, headers);
        response.end();
      });
  }
  
  response.writeHead(404, {'Content-Type': 'text/plain'});
  response.write('Not found');
  response.end();
};

Restore.prototype.parseBody = function(request, callback) {
  var body        = '',
      contentType = (request.headers['content-type'] || '').split(/\s*;\s*/)[0];
  
  request.setEncoding('utf8');
  request.addListener('data', function(chunk) { body += chunk });
  request.addListener('end', function() {
    var params = (contentType === 'application/x-www-form-urlencoded') ? qs.parse(body) : body;
    callback(null, params);
  });
};

Restore.prototype.renderXRD = function(response, file, locals) {
  fs.readFile(__dirname + '/views/' + file, function(error, xml) {
    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/xrd+xml'
    });
    response.write(ejs.render(xml.toString(), {locals: locals || {}}));
    response.end();
  });
};

Restore.prototype.renderJSON = function(response, file, locals) {
  fs.readFile(__dirname + '/views/' + file, function(error, json) {
    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    });
    response.write(ejs.render(json.toString(), {locals: locals || {}}));
    response.end();
  });
};

Restore.prototype.renderHTML = function(response, status, file, locals) {
  fs.readFile(__dirname + '/views/' + file, function(error, html) {
    response.writeHead(status, {'Content-Type': 'text/html'});
    response.write(ejs.render(html.toString(), {locals: locals || {}}));
    response.end();
  });
};

module.exports = Restore;
module.exports.File = require('./stores/file');

