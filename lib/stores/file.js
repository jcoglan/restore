var fs     = require('fs'),
    path   = require('path'),
    crypto = require('crypto'),
    mkdirp = require('mkdirp'),
    core   = require('./core');

var FileStore = function(directory) {
  this._dir   = path.resolve(directory);
  this._queue = new core.Queues();
};

FileStore.prototype.authPath = function(username) {
  return path.join(username.substr(0,2), username, 'auth.json');
};

FileStore.prototype.dataPath = function(username, scope) {
  return path.join(username.substr(0,2), username, 'data', scope + '.json');
};

FileStore.prototype.createUser = function(params, callback) {
  var self   = this,
      errors = core.validateUser(params);
  
  if (errors.length > 0) return callback(errors[0]);
  
  var userPath = this.authPath(params.username);
  this.writeFile(userPath, function(error, json, write) {
    if (json)
      return write(null, function() {
        callback(new Error('The username is already taken'));
      });
    
    core.hashPassword(params.password, null, function(error, hash) {
      var data = {password: hash};
      write(JSON.stringify(data, true, 2), callback);
    });
  });
};

FileStore.prototype.authenticate = function(params, callback) {
  var username = (params.username || '').split('@')[0];
  this.readFile(this.authPath(username), function(error, json) {
    if (error) return callback(new Error('Username not found'));
    
    var user = JSON.parse(json),
        key  = user.password.key;
    
    core.hashPassword(params.password, user.password, function(error, hash) {
      if (hash.key === key)
        callback(null);
      else
        callback(new Error('Incorrect password'));
    });
  });
};

FileStore.prototype.authorize = function(clientId, username, scope, callback) {
  var username = username.split('@')[0],
      scopes   = scope.split(/\s+/);
  
  this.writeFile(this.authPath(username), function(error, json, write) {
    if (error) return callback(error);
    
    var user = JSON.parse(json);
    user.clients = user.clients || {};
    var client = user.clients[clientId] = user.clients[clientId] || {scopes: []};
    
    for (var i = 0, n = scopes.length; i < n; i++) {
      if (client.scopes.indexOf(scopes[i]) < 0) client.scopes.push(scopes[i]);
    }
    
    var tokenData   = {u: username, c: clientId, s: scope},
        tokenString = new Buffer(JSON.stringify(tokenData), 'utf8').toString('base64'),
        hmac        = crypto.createHmac('sha256', user.password.key);
    
    hmac.update(tokenString);
    tokenString += '|' + hmac.digest('hex');
    
    write(JSON.stringify(user, true, 2), function(error) {
      if (error)
        callback(error);
      else
        callback(null, tokenString);
    });
  });
};

FileStore.prototype.checkToken = function(token, username, scope, callback) {
  var parts = token.split('|'),
      body  = parts[0],
      hmac  = parts[1],
      auth  = JSON.parse(new Buffer(body, 'base64').toString('utf8'));
  
  username = username.split('@')[0];
  this.readFile(this.authPath(username), function(error, json) {
    if (error) return callback(error);
    
    var user  = JSON.parse(json),
        check = crypto.createHmac('sha256', user.password.key);
    
    check.update(body);
    check = check.digest('hex');
    
    if (user.clients && user.clients[auth.c] && user.clients[auth.c].scopes.indexOf(auth.s) >= 0 && check === hmac) {
      callback(null);
    } else {
      callback(new Error('Invalid access token'));
    }
  });
};

FileStore.prototype.get = function(token, username, scope, key, callback) {
  var self     = this,
      username = username.split('@')[0];
  
  this.checkToken(token, username, scope, function(error) {
    if (error) return callback(error);
    
    self.readFile(self.dataPath(username, scope), function(error, json) {
      callback(error, error ? null : JSON.parse(json)[key]);
    });
  });
};

FileStore.prototype.put = function(token, username, scope, key, value, callback) {
  var self     = this,
      username = username.split('@')[0];
  
  this.checkToken(token, username, scope, function(error) {
    if (error) return callback(error);
    
    self.writeFile(self.dataPath(username, scope), function(error, json, write) {
      var data = error ? {} : JSON.parse(json);
      data[key] = value;
      write(JSON.stringify(data, true, 2), callback);
    });
  });
};

FileStore.prototype.delete = function(token, username, scope, key, callback) {
  var self     = this,
      username = username.split('@')[0];
  
  this.checkToken(token, username, scope, function(error) {
    if (error) return callback(error);
    
    self.writeFile(self.dataPath(username, scope), function(error, json, write) {
      var data = error ? {} : JSON.parse(json);
      delete data[key];
      write(JSON.stringify(data, true, 2), callback);
    });
  });
};

FileStore.prototype.readFile = function(filename, callback) {
  var fullPath = path.join(this._dir, filename);
  fs.readFile(fullPath, function(error, content) {
    callback(error, error ? null : content.toString());
  });
};

FileStore.prototype.writeFile = function(filename, writer) {
  var fullPath = path.join(this._dir, filename);
  this._queue.get(fullPath).push(function(done) {
    fs.readFile(fullPath, function(error, content) {
      writer(error, error ? null : content.toString(), function(newContent, callback) {
        if (newContent === null) {
          callback(null);
          done();
        } else {
          mkdirp(path.dirname(fullPath), function() {
            fs.writeFile(fullPath, newContent, function(error) {
              callback(error);
              done();
            });
          });
        }
      });
    });
  });
};

module.exports = FileStore;

