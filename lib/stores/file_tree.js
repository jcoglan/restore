var async  = require('async'),
    core   = require('./core'),
    fs     = require('fs'),
    path   = require('path'),
    mkdirp = require('mkdirp'),
    util   = require('util');

var FileTree = function(options) {
  this._dir   = path.resolve(options.path);
  this._queue = new core.Queues();
  this.queryToken = core.queryToken;
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

  return path.join(username.substr(0,2), username, 'storage', dir, '.' + name + '.meta');
};

FileTree.prototype.dirname = function(username, _path) {
  return path.dirname(path.join(this._dir, this.dataPath(username, _path + '_')));
};

FileTree.prototype.childPaths = function(username, _path, callback) {
  fs.readdir(this.dirname(username, _path), function(error, entries) {
    callback(error ? [] : entries.sort());
  });
};

FileTree.prototype.touch = function(dirname, modified, callback) {
  fs.stat(dirname, function(error, stat) {
    if (error) return callback(error);
    fs.utimes(dirname, stat.atime.getTime() / 1000, modified / 1000, callback);
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
      var data = {email: params.email, password: hash};
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

    var user  = JSON.parse(json),
        token = core.generateToken(),
        session,
        category;

    user.sessions = user.sessions || {};
    session = user.sessions[token] = {clientId: clientId, permissions: {}};

    for (var scope in permissions) {
      category = scope.replace(/^\/?/, '/').replace(/\/?$/, '/');
      session.permissions[category] = {};
      for (var i = 0, n = permissions[scope].length; i < n; i++) {
        session.permissions[category][permissions[scope][i]] = true;
      }
    }

    write(JSON.stringify(user, true, 2), function(error) {
      if (error)
        callback(error);
      else
        callback(null, token);
    });
  });
};

FileTree.prototype.revokeAccess = function(username, token, callback) {
  callback = callback || function() {};
  this.writeFile(this.authPath(username), function(error, json, write) {
    if (error) return callback(error);
    var user = JSON.parse(json);
    if (user.sessions) delete user.sessions[token];
    write(JSON.stringify(user, true, 2), callback);
  });
};

FileTree.prototype.permissions = function(username, token, callback) {
  this.readFile(this.authPath(username), function(error, json) {
    if (error) return callback(null, {});
    var data = JSON.parse(json).sessions;
    if (!data || !data[token]) return callback(null, {});

    var permissions = data[token].permissions,
        output      = {};

    for (var category in permissions)
      output[category] = Object.keys(permissions[category]).sort();

    return callback(null, output);
  });
};

FileTree.prototype.error = function(message, status) {
  var error = new Error(message);
  error.status = status;
  return error;
};

FileTree.prototype._versionMatch = function(version, modified) {
  if (!version || !modified) return false;
  return version === modified;
};

FileTree.prototype.get = function(username, _path, version, callback) {
  var self     = this,
      isdir    = /\/$/.test(_path),
      dataPath = this.dataPath(username, _path),
      metaPath = this.metaPath(username, _path);

  this._lock(username, function(release) {
    if (isdir) {
      fs.stat(self.dirname(username, _path), function(error, stat) {
        var mtime = stat && new Date(stat.mtime.getTime()).getTime();
        self.childPaths(username, _path, function(entries) {
          if (entries.length === 0) {
            release();
            return callback(null, null);
          }
          entries = entries.filter(function(e) { return !/\.meta$/.test(e) });
          async.map(entries, function(entry, callback) {
            self._getListing(username, _path, entry, callback);
          }, function(error, listing) {
            release();
            callback(null, {children: listing, modified: mtime}, self._versionMatch(version, mtime));
          });
        });
      });
    } else {
      self.readFile(dataPath, function(error, blob, modified) {
        self.readFile(metaPath, function(error, json, modified) {
          if (error) {
            release();
            return callback(null, null);
          }
          var record = JSON.parse(json);
          record.modified = modified;
          record.value = blob;
          release();
          callback(null, record, self._versionMatch(version, modified));
        });
      });
    }
  });
};

FileTree.prototype._getListing = function(username, _path, entry, callback) {
  var fullPath = path.join(this.dirname(username, _path), entry);
  fs.stat(fullPath, function(error, stat) {
    callback(error, {
      name:     entry.replace(/\.(blob|d)$/, function(_,m) { return m === 'd' ? '/' : '' }),
      modified: new Date(stat.mtime.getTime()).getTime()
    });
  });
};

FileTree.prototype.put = function(username, _path, type, value, version, callback) {
  var self  = this,
      query = core.parsePath(_path),
      name  = query.pop();

  this._lock(username, function(release) {
    var dataPath = path.join(self._dir, self.dataPath(username, _path)),
        metaPath = path.join(self._dir, self.metaPath(username, _path));

    self.isCurrentVersion(dataPath, version, function(error, current) {
      if (error || !current) {
        release();
        return callback(error, null, null, true);
      }
      async.waterfall([
        function(next) {
          self.writeBlob(metaPath, JSON.stringify({length: value.length, type: type}, true, 2), next);
        },
        function(exists, modified, next) {
          self.writeBlob(dataPath, value, next);
        },
        function(exists, modified, next) {
          async.forEach(core.indexed(query), function(entry, done) {
            var q = entry.value, i = entry.index;
            self.touch(self.dirname(username, query.slice(0, i+1).join('')), modified, done);
          }, function() {
            next(null, exists, modified);
          });
        }
      ], function(error, exists, modified) {
        release();
        callback(error, !exists, modified);
      });
    });
  });
};

FileTree.prototype.delete = function(username, _path, version, callback) {
  var self = this;

  this._lock(username, function(release) {
    self._delete(username, _path, version, function(exists, modified, conflict) {
      if (!exists || conflict) {
        release();
        return callback(null, exists, null, conflict);
      }

      self._removeParents(username, _path, function() {
        release();
        callback(null, true, modified);
      });
    });
  });
};

FileTree.prototype._delete = function(username, _path, version, callback) {
  var dataPath = path.join(this._dir, this.dataPath(username, _path)),
      metaPath = path.join(this._dir, this.metaPath(username, _path));

  this.isCurrentVersion(dataPath, version, function(error, current, modified) {
    if (error || !current)
      return callback(false, null, !current);

    fs.unlink(dataPath, function(error) {
      fs.unlink(metaPath, function(error) {
        callback(!error, modified);
      });
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
            callback(error, stat.mtime.getTime());
          });
        }, function(error, mtimes) {
          var modified = Math.max.apply(Math, mtimes);
          self.touch(dirname, modified, done);
        });
      }
    });
  }, callback);
};

FileTree.prototype.readFile = function(filename, callback) {
  var fullPath = path.join(this._dir, filename);
  fs.readFile(fullPath, function(error, content) {
    fs.stat(fullPath, function(error, stat) {
      var mtime = stat && new Date(stat.mtime.getTime()).getTime();
      callback(error, error ? null : content, error ? null : mtime);
    });
  });
};

FileTree.prototype.writeFile = function(filename, writer) {
  var fullPath = path.join(this._dir, filename),
      self     = this;

  this._lock(fullPath, function(release) {
    fs.stat(fullPath, function(error, stat) {
      fs.readFile(fullPath, function(error, content) {
        writer(error, error ? null : content.toString(), function(newContent, callback) {
          if (newContent === null) {
            release();
            callback(null, !!stat);
          } else {
            self.writeBlob(fullPath, newContent, function(error) {
              release();
              callback(error, !!stat);
            });
          }
        });
      });
    });
  });
};

FileTree.prototype.isCurrentVersion = function(fullPath, version, callback) {
  fs.stat(fullPath, function(error, stat) {
    var mtime = stat && new Date(stat.mtime.getTime()).getTime();
    if (!version) return callback(null, true, mtime);
    if (error) return callback(null, false);
    callback(null, mtime === version, mtime);
  });
};

FileTree.prototype.writeBlob = function(fullPath, newContent, callback) {
  var tmpPath = fullPath + '.tmp';

  mkdirp(path.dirname(fullPath), function(error) {
    fs.writeFile(tmpPath, newContent, function(error) {
      fs.stat(fullPath, function(error, exists) {
        fs.rename(tmpPath, fullPath, function(error) {
          fs.stat(fullPath, function(e, stat) {
            callback(error, !!exists, stat && new Date(stat.mtime.getTime()).getTime());
          });
        });
      });
    });
  });
};

FileTree.prototype.keyPath = function(username, key) {
  var b, i, parts = key.split('/');
  for (i=0; i<parts.length; i++) {
    b = new Buffer(parts[i]);
    parts[i] = b.toString('hex');
  }
  return path.join(this._dir, username.substr(0,2), username, 'storage', parts.join('/') + '-RS');
}
FileTree.prototype.getItem = function(username, key, callback) {
  fs.readFile(this.keyPath(username, key), function(err, data) {
    if (err && err.code === "ENOENT") {
      callback(null, undefined);
    } else {
      callback(err, data);
    }
  });
};
FileTree.prototype.putItem = function(username, key, value, callback) {
  var _path = this.keyPath(username, key);
  mkdirp(path.dirname(_path), function(err) {
    if (err) {
      callback(err);
    } else {
      fs.writeFile(_path, value, function(err) {
        callback(err);
      });
    }
  });
};
FileTree.prototype.deleteItem = function(username, key, callback) {
  fs.unlink(this.keyPath(username, key), function(err) {
    if (err && err.code === "ENOENT") {
      callback(null);
    } else {
      callback(err);
    }
  });
};

module.exports = FileTree;

