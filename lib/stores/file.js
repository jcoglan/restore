var fs     = require('fs.extra'),
    path   = require('path'),
    AES    = require('vault/node/aes'),
    core   = require('./core');

var FileStore = function(directory) {
  this._dir   = path.resolve(directory);
  this._queue = new core.Queues();
};

FileStore.prototype.parsePath = function(path) {
  return path.split(/\b(?!\/)/).slice(1);
};

FileStore.prototype.authPath = function(username) {
  return path.join(username.substr(0,2), username, 'auth.json');
};

FileStore.prototype.dataPath = function(username, category) {
  return path.join(username.substr(0,2), username, 'data', category + '.json');
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

FileStore.prototype.authorize = function(clientId, username, permissions, callback) {
  var username = username.split('@')[0];
  
  this.writeFile(this.authPath(username), function(error, json, write) {
    if (error) return callback(error);
    
    var user = JSON.parse(json);
    user.clients = user.clients || {};
    var client = user.clients[clientId] = user.clients[clientId] || {};
    
    for (var category in permissions) {
      client[category] = client[category] || [];
      for (var i = 0, n = permissions[category].length; i < n; i++) {
        if (client[category].indexOf(permissions[category][i]) < 0)
          client[category].push(permissions[category][i]);
      }
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

FileStore.prototype.checkToken = function(token, username, category, permission, callback) {
  username = username.split('@')[0];
  category = category.replace(/^public\//, '');
  
  var self = this;
  this.readFile(this.authPath(username), function(error, json) {
    if (error) return callback(self.error('Invalid access token', 401));
    
    var user = JSON.parse(json),
        aes  = new AES(user.password.key);
    
    aes.decrypt(token, function(error, clientId) {
      if (error) return callback(self.error('Invalid access token', 401));
      
      if (user.clients && user.clients[clientId] &&
          user.clients[clientId].hasOwnProperty(category) &&
          user.clients[clientId][category].indexOf(permission) >= 0) {
        callback(null);
      } else {
        callback(self.error('Invalid access token', 403));
      }
    });
  });
};

FileStore.prototype.error = function(message, status) {
  var error = new Error(message);
  error.status = status;
  return error;
};

FileStore.prototype.get = function(token, username, category, path, callback) {
  var self     = this,
      username = username.split('@')[0],
      query    = this.parsePath(path),
      isdir    = /\/$/.test(path);
  
  this.checkToken(token, username, category, 'r', function(error) {
    if (error && (!/^public\//.test(category) || isdir)) return callback(error);
    
    self.readFile(self.dataPath(username, category), function(error, json) {
      if (error) return callback(null, isdir ? [] : null);
      
      var data   = JSON.parse(json),
          record = data,
          listing;
      
      for (var i = 0, n = query.length; i < n; i++)
        record = record && record.children[query[i]];
      
      if (isdir) {
        if (!record) return callback(null, []);
        listing = Object.keys(record.children).sort().map(function(name) {
          return {name: name, modified: new Date(record.children[name].modified)};
        });
        return callback(null, listing);
      }
      
      if (!record) return callback(null, null);
      
      callback(null, {
        type:     record.type,
        modified: new Date(record.modified),
        value:    record.value
      });
    });
  });
};

FileStore.prototype.put = function(token, username, category, path, type, value, callback) {
  var self     = this,
      username = username.split('@')[0],
      query    = this.parsePath(path),
      name     = query.pop(),
      isdir    = /\/$/.test(name);
  
  this.checkToken(token, username, category, 'w', function(error) {
    if (error) return callback(error);
    if (isdir) return callback(null, false);
    
    self.writeFile(self.dataPath(username, category), function(error, json, write) {
      var data = error ? {children: {}} : JSON.parse(json),
          dir  = data;
      
      for (var i = 0, n = query.length; i < n; i++) {
        if (!dir.children[query[i]]) dir.children[query[i]] = {children: {}};
        dir = dir.children[query[i]];
      }
      
      var exists   = dir.children.hasOwnProperty(name),
          modified = new Date().getTime();
      
      dir.children[name] = {
        type:     type,
        modified: modified,
        value:    value
      };
      
      dir = data;
      dir.modified = modified;
      for (var i = 0, n = query.length; i < n; i++) {
        dir = dir.children[query[i]];
        dir.modified = modified;
      }
      
      write(JSON.stringify(data, true, 2), function(error) {
        callback(error, !exists);
      });
    });
  });
};

FileStore.prototype.delete = function(token, username, category, path, callback) {
  var self     = this,
      username = username.split('@')[0],
      query    = this.parsePath(path),
      name     = query.pop(),
      isdir    = /\/$/.test(name);
  
  this.checkToken(token, username, category, 'w', function(error) {
    if (error) return callback(error);
    if (isdir) return callback(null, false);
    
    self.writeFile(self.dataPath(username, category), function(error, json, write) {
      var data = error ? {children: {}} : JSON.parse(json),
          dir  = data;
      
      for (var i = 0, n = query.length; i < n; i++)
        dir = dir && dir.children[query[i]];
      
      if (!dir) return callback(null, false);
      
      var exists = dir.children.hasOwnProperty(name);
      delete dir.children[name];
      
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

