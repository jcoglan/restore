var Cipher = require('vault-cipher'),
    async  = require('async'),
    core   = require('./core'),
    fs     = require('fs'),
    path   = require('path'),
    mkdirp = require('mkdirp'),
    path   = require('path'),
    util   = require('util'),
    
    exists = fs.exists || path.exists;

var FileTree = function(options) {
  this._dir   = path.resolve(options.path);
  this._queue = new core.Queues();
};

FileTree.prototype._lock = function(name, callback) {
  this._queue.get(name).push(callback);
};

FileTree.prototype.authPath = function(username) {
  return path.join(username.substr(0,2), username, 'auth.json');
};

FileTree.prototype.dataPath = function(username, _path) {
  var query = core.parsePath(_path).slice(1),
      name  = query.pop() || '',
      dir   = query.map(function(q) { return q.replace(/\/$/, '.d') }).join('/');
  
  return path.join(username.substr(0,2), username, 'storage', dir, name + '.blob');
};

FileTree.prototype.metaPath = function(username, _path) {
  var query = core.parsePath(_path).slice(1),
      name  = query.pop() || '',
      dir   = query.map(function(q) { return q.replace(/\/$/, '.d') }).join('/');
  
  return path.join(username.substr(0,2), username, 'storage', dir, '.' + name + '.json');
};

FileTree.prototype.dirname = function(username, _path) {
  return path.dirname(path.join(this._dir, this.dataPath(username, _path + '_')));
};

FileTree.prototype.childPaths = function(username, path, callback) {
  fs.readdir(this.dirname(username, path), function(error, entries) {
    callback(error ? [] : entries.sort());
  });
};

FileTree.prototype.touch = function(dirname, modified, callback) {
  fs.stat(dirname, function(error, stat) {
    if (error) return callback(error);
    fs.utimes(dirname, stat.atime.getTime() / 1000, modified.getTime() / 1000, callback);
  });
};

FileTree.prototype.createUser = function(params, callback) {
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

FileTree.prototype.authenticate = function(params, callback) {
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

FileTree.prototype.authorize = function(clientId, username, permissions, callback) {
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
    
    var cipher = new Cipher(user.password.key);
    
    cipher.encrypt(clientId, function(error, token) {
      write(JSON.stringify(user, true, 2), function(error) {
        if (error)
          callback(error);
        else
          callback(null, token);
      });
    });
  });
};

FileTree.prototype.authorizations = function(username, callback) {
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

FileTree.prototype.clientForToken = function(username, token, callback) {
  this.readFile(this.authPath(username), function(error, json) {
    if (error) return callback(error);
    
    var user   = JSON.parse(json),
        cipher = new Cipher(user.password.key);
    
    cipher.decrypt(token, callback);
  });
};

FileTree.prototype.error = function(message, status) {
  var error = new Error(message);
  error.status = status;
  return error;
};

FileTree.prototype.get = function(username, path, callback) {
  var self     = this,
      isdir    = /\/$/.test(path),
      dataPath = this.dataPath(username, path),
      metaPath = this.metaPath(username, path);
  
  if (isdir) {
    this._lock(username, function(release) {
      self.childPaths(username, path, function(entries) {
        entries = entries.filter(function(e) { return !/\.json$/.test(e) });
        async.map(entries, function(entry, callback) {
          self._getListing(username, path, entry, callback);
        }, function(error, listing) {
          release();
          callback(null, listing);
        });
      });
    });
  } else {
    this.readFile(dataPath, function(error, blob, modified) {
      self.readFile(metaPath, function(error, json, modified) {
        if (error) return callback(null, null);
        var record = JSON.parse(json);
        record.modified = modified;
        record.value = blob;
        callback(null, record);
      });
    });
  }
};

FileTree.prototype._getListing = function(username, _path, entry, callback) {
  var fullPath = path.join(this.dirname(username, _path), entry);
  fs.stat(fullPath, function(error, stat) {
    callback(error, {
      name:     entry.replace(/\.(d|blob)$/, function(_,m) { return m === 'd' ? '/' : '' }),
      modified: stat.mtime
    });
  });
};

FileTree.prototype.put = function(username, _path, type, value, callback) {
  var self  = this,
      query = core.parsePath(_path),
      name  = query.pop();
  
  this._lock(username, function(release) {
    var modified = new Date(),
        dataPath = path.join(self._dir, self.dataPath(username, _path)),
        metaPath = path.join(self._dir, self.metaPath(username, _path));
    
    async.waterfall([
      function(next) {
        self.writeBlob(dataPath, value, next);
      },
      function(exists, next) {
        self.writeBlob(metaPath, JSON.stringify({type: type}, true, 2), next);
      },
      function(exists, next) {
        async.forEach(core.indexed(query), function(entry, done) {
          var q = entry.value, i = entry.index;
          self.touch(self.dirname(username, query.slice(0, i+1).join('')), modified, done);
        }, function() {
          next(null, exists);
        });
      }
    ], function(error, exists) {
      release();
      callback(error, !exists, modified);
    });
  });
};

FileTree.prototype.delete = function(username, path, callback) {
  var self = this;
  
  this._lock(username, function(release) {
    self._delete(username, path, function(exists) {
      if (!exists) {
        release();
        return callback(null, false);
      }
      
      self._removeParents(username, path, function() {
        release();
        callback(null, true);
      });
    });
  });
};

FileTree.prototype._delete = function(username, _path, callback) {
  var dataPath = path.join(this._dir, this.dataPath(username, _path)),
      metaPath = path.join(this._dir, this.metaPath(username, _path));
  
  fs.unlink(dataPath, function(error) {
    fs.unlink(metaPath, function(error) {
      callback(!error);
    });
  });
};

FileTree.prototype._removeParents = function(username, _path, callback) {
  var self    = this,
      query   = core.parsePath(_path),
      name    = query.pop(),
      parents = core.parents(_path);
  
  async.forEachSeries(parents, function(parent, done) {
    var dirname = self.dirname(username, parent);
    
    self.childPaths(username, parent, function(entries) {
      if (entries.length === 0) {
        fs.rmdir(dirname, done);
      } else {
        async.map(entries, function(entry, callback) {
          fs.stat(path.join(dirname, entry), function(error, stat) {
            callback(error, stat.mtime);
          });
        }, function(error, mtimes) {
          var modified = Math.max.apply(Math, mtimes);
          self.touch(dirname, new Date(modified), done);
        });
      }
    });
  }, callback);
};

FileTree.prototype.readFile = function(filename, callback) {
  var fullPath = path.join(this._dir, filename);
  fs.readFile(fullPath, function(error, content) {
    fs.stat(fullPath, function(error, stat) {
      callback(error, error ? null : content, error ? null : stat.mtime);
    });
  });
};

FileTree.prototype.writeFile = function(filename, writer) {
  var fullPath = path.join(this._dir, filename),
      self     = this;
  
  this._lock(fullPath, function(release) {
    exists(fullPath, function(exists) {
      fs.readFile(fullPath, function(error, content) {
        writer(error, error ? null : content.toString(), function(newContent, callback) {
          if (newContent === null) {
            release();
            callback(null, exists);
          } else {
            self.writeBlob(fullPath, newContent, function(error) {
              release();
              callback(error, exists);
            });
          }
        });
      });
    });
  });
};

FileTree.prototype.writeBlob = function(fullPath, newContent, callback) {
  mkdirp(path.dirname(fullPath), function(error) {
    fs.writeFile(fullPath + '.tmp', newContent, function(error) {
      exists(fullPath, function(exists) {
        fs.rename(fullPath + '.tmp', fullPath, function(error) {
          callback(error, exists);
        });
      });
    });
  });
};

module.exports = FileTree;

