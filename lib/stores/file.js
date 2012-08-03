var fs     = require('fs.extra'),
    path   = require('path'),
    AES    = require('vault/node/aes'),
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
    
    var aes = new AES(user.password.key);
    
    aes.encrypt(clientId, function(error, token) {
      write(JSON.stringify(user, true, 2), function(error) {
        if (error)
          callback(error);
        else
          callback(null, token);
      });
    });
  });
};

FileStore.prototype.checkToken = function(token, username, scope, callback) {
  username = username.split('@')[0];
  this.readFile(this.authPath(username), function(error, json) {
    if (error) return callback(new Error('Invalid access token'));
    
    var user = JSON.parse(json),
        aes  = new AES(user.password.key);
    
    aes.decrypt(token, function(error, clientId) {
      if (error) return callback(new Error('Invalid access token'));
      
      if (user.clients && user.clients[clientId] && user.clients[clientId].scopes.indexOf(scope) >= 0) {
        callback(null);
      } else {
        callback(new Error('Invalid access token'));
      }
    });
  });
};

FileStore.prototype.get = function(token, username, scope, key, callback) {
  var self     = this,
      username = username.split('@')[0];
  
  this.checkToken(token, username, scope, function(error) {
    if (error) return callback(error);
    
    self.readFile(self.dataPath(username, scope), function(error, json) {
      if (error) return callback(null, null);
      var record = JSON.parse(json)[key];
      if (!record) return callback(null, null);
      callback(null, {
        type:     record.type,
        modified: new Date(record.modified),
        value:    record.value
      });
    });
  });
};

FileStore.prototype.put = function(token, username, scope, key, type, value, callback) {
  var self     = this,
      username = username.split('@')[0];
  
  this.checkToken(token, username, scope, function(error) {
    if (error) return callback(error);
    
    self.writeFile(self.dataPath(username, scope), function(error, json, write) {
      var data   = error ? {} : JSON.parse(json),
          exists = data.hasOwnProperty(key);
      
      data[key] = {
        type:     type,
        modified: new Date().getTime(),
        value:    value
      };
      write(JSON.stringify(data, true, 2), function(error) {
        callback(error, !exists);
      });
    });
  });
};

FileStore.prototype.delete = function(token, username, scope, key, callback) {
  var self     = this,
      username = username.split('@')[0];
  
  this.checkToken(token, username, scope, function(error) {
    if (error) return callback(error);
    
    self.writeFile(self.dataPath(username, scope), function(error, json, write) {
      var data   = error ? {} : JSON.parse(json),
          exists = data.hasOwnProperty(key);
      
      delete data[key];
      write(JSON.stringify(data, true, 2), function(error) {
        callback(error, exists);
      });
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
          fs.mkdirp(path.dirname(fullPath), function() {
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

