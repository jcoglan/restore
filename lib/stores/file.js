var fs     = require('fs'),
    mkdirp = require('mkdirp'),
    path   = require('path'),
    AES    = require('vault/node/aes'),
    core   = require('./core');

var FileStore = function(options) {
  this._dir   = path.resolve(options.path);
  this._queue = new core.Queues();
};

FileStore.prototype.authPath = function(username) {
  return path.join(username.substr(0,2), username, 'auth.json');
};

FileStore.prototype.dataPath = function(username, key) {
  return path.join(username.substr(0,2), username, 'data.json');
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
  var username = params.username || '';
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
  this.writeFile(this.authPath(username), function(error, json, write) {
    if (error) return callback(error);
    
    var user = JSON.parse(json), category;
    user.clients = user.clients || {};
    var client = user.clients[clientId] = user.clients[clientId] || {};
    
    for (var scope in permissions) {
      category = scope.replace(/^\/?/, '/').replace(/\/?$/, '/');
      client[category] = client[category] || {};
      for (var i = 0, n = permissions[scope].length; i < n; i++) {
        client[category][permissions[scope][i]] = true;
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

FileStore.prototype.authorizations = function(username, callback) {
  this.readFile(this.authPath(username), function(error, json) {
    if (error) return callback(null, {});
    var data = JSON.parse(json).clients;
    if (!data) return callback(null, {});
    var authorizations = {}, id, dir;
    for (id in data) {
      authorizations[id] = {};
      for (dir in data[id]) {
        authorizations[id][dir.replace(/^\/?/, '/').replace(/\/?$/, '/')] =
          Object.keys(data[id][dir]).sort();
      }
    }
    callback(null, authorizations);
  });
};

FileStore.prototype.clientForToken = function(username, token, callback) {
  this.readFile(this.authPath(username), function(error, json) {
    if (error) return callback(error);
    
    var user = JSON.parse(json),
        aes  = new AES(user.password.key);
    
    aes.decrypt(token, callback);
  });
};

FileStore.prototype.error = function(message, status) {
  var error = new Error(message);
  error.status = status;
  return error;
};

FileStore.prototype.get = function(username, path, callback) {
  var self  = this,
      query = core.parsePath(path),
      isdir = /\/$/.test(path);
  
  this.readFile(self.dataPath(username, path), function(error, json) {
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
      value:    new Buffer(record.value)
    });
  });
};

FileStore.prototype.put = function(username, path, type, value, callback) {
  var self  = this,
      query = core.parsePath(path),
      name  = query.pop();
  
  this.writeFile(self.dataPath(username, path), function(error, json, write) {
    var modified = new Date(),
        data     = error ? {children: {}} : JSON.parse(json),
        dir      = data;
    
    for (var i = 0, n = query.length; i < n; i++) {
      if (!dir.children[query[i]]) dir.children[query[i]] = {children: {}};
      dir = dir.children[query[i]];
      dir.modified = modified.getTime();
    }
    
    var exists = dir.children.hasOwnProperty(name);
    
    dir.children[name] = {
      type:     type,
      modified: modified.getTime(),
      value:    value.toString()
    };
    
    write(JSON.stringify(data, true, 2), function(error) {
      callback(error, !exists, modified);
    });
  });
};

FileStore.prototype.delete = function(username, path, callback) {
  var self  = this,
      query = core.parsePath(path),
      name  = query.pop();
  
  self.writeFile(self.dataPath(username, path), function(error, json, write) {
    var data  = error ? {children: {}} : JSON.parse(json),
        dir   = data,
        stack = [],
        level, keys;
    
    for (var i = 0, n = query.length; i < n; i++) {
      stack.push(dir);
      dir = dir && dir.children[query[i]];
    }
    
    if (!dir) return callback(null, false);
    
    var exists = dir.children.hasOwnProperty(name);
    delete dir.children[name];
    
    n = stack.length;
    while (n--) {
      level = stack[n].children[query[n]];
      keys  = Object.keys(level.children);
      if (keys.length === 0)
        delete stack[n].children[query[n]];
      else
        level.modified = Math.max.apply(Math, keys.map(function(k) { return level.children[k].modified }));
    }
    
    write(JSON.stringify(data, true, 2), function(error) {
      callback(error, exists);
    });
  });
};

FileStore.prototype.readFile = function(filename, callback) {
  var fullPath = path.join(this._dir, filename);
  fs.readFile(fullPath, function(error, content) {
    fs.stat(fullPath, function(error, stat) {
      callback(error, error ? null : content.toString(), error ? null : stat.mtime);
    });
  });
};

FileStore.prototype.writeFile = function(filename, writer) {
  var fullPath = path.join(this._dir, filename);
  this._lock(fullPath, function(release) {
    fs.exists(fullPath, function(exists) {
      fs.readFile(fullPath, function(error, content) {
        writer(error, error ? null : content.toString(), function(newContent, callback) {
          if (newContent === null) {
            release();
            callback(null, exists);
          } else {
            mkdirp(path.dirname(fullPath), function(error) {
              fs.writeFile(fullPath + '.tmp', newContent, function(error) {
                fs.rename(fullPath + '.tmp', fullPath, function(error) {
                  release();
                  callback(error, exists);
                });
              });
            });
          }
        });
      });
    });
  });
};

FileStore.prototype._lock = function(name, callback) {
  this._queue.get(name).push(callback);
};

module.exports = FileStore;

