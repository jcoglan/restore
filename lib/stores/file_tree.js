'use strict';

var async    = require('async'),
    core     = require('./core'),
    fs       = require('fs'),
    lockfile = require('lockfile'),
    mkdirp   = require('mkdirp'),
    path     = require('path'),
    rename   = require('./rename'),
    util     = require('util');

var FileTree = function(options) {
  this._dir = path.resolve(options.path);

  this._renameLegacyFiles();
};

FileTree.prototype._lock = function(username, callback) {
  var lockPath = path.join(this._dir, username.substr(0,2), username, '.lock'),
      self     = this;

  mkdirp(path.dirname(lockPath), function() {
    lockfile.lock(lockPath, {wait: 10000}, function(error) {
      if (error)
        return lockfile.unlock(lockPath, function() { self._lock(username, callback) });

      callback(function() { lockfile.unlockSync(lockPath) });
    });
  });
};

FileTree.prototype.authPath = function(username) {
  return path.join(username.substr(0,2), username, 'auth.json');
};

FileTree.prototype.dataPath = function(username, pathname) {
  var query    = core.parsePath(pathname).slice(1),
      filename = query.pop() || '',
      dir      = query.map(function(q) { return q.replace(/\/$/, '~') }).join('/');

  return path.join(username.substr(0,2), username, 'storage', dir, filename);
};

FileTree.prototype.metaPath = function(username, pathname) {
  var query    = core.parsePath(pathname).slice(1),
      filename = query.pop() || '',
      dir      = query.map(function(q) { return q.replace(/\/$/, '~') }).join('/');

  return path.join(username.substr(0,2), username, 'storage', dir, '.~' + filename);
};

FileTree.prototype.dirname = function(username, pathname) {
  return path.dirname(path.join(this._dir, this.dataPath(username, pathname + '_')));
};

FileTree.prototype.childPaths = function(username, path, callback) {
  fs.readdir(this.dirname(username, path), function(error, entries) {
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

FileTree.prototype.get = function(username, path, version, callback) {
  var self     = this,
      isdir    = /\/$/.test(path),
      dataPath = this.dataPath(username, path),
      metaPath = this.metaPath(username, path);

  this._lock(username, function(release) {
    if (isdir) {
      fs.stat(self.dirname(username, path), function(error, stat) {
        var mtime = stat && new Date(stat.mtime.getTime()).getTime();
        self.childPaths(username, path, function(entries) {
          if (entries.length === 0) {
            release();
            return callback(null, null);
          }
          entries = entries.filter(function(e) { return !/^\.~/.test(e) });
          async.map(entries, function(entry, callback) {
            self._getListing(username, path, entry, callback);
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

FileTree.prototype._getListing = function(username, pathname, entry, callback) {
  var fullPath = path.join(this.dirname(username, pathname), entry);
  fs.stat(fullPath, function(error, stat) {
    callback(error, {
      name:     entry.replace(/~$/, '/'),
      modified: new Date(stat.mtime.getTime()).getTime()
    });
  });
};

FileTree.prototype.put = function(username, pathname, type, value, version, callback) {
  var self     = this,
      query    = core.parsePath(pathname),
      filename = query.pop();

  this._lock(username, function(release) {
    var dataPath = path.join(self._dir, self.dataPath(username, pathname)),
        metaPath = path.join(self._dir, self.metaPath(username, pathname));

    self.getCurrentState(dataPath, version, function(error, current) {
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

FileTree.prototype.delete = function(username, path, version, callback) {
  var self = this;

  this._lock(username, function(release) {
    self._delete(username, path, version, function(exists, modified, conflict) {
      if (!exists || conflict) {
        release();
        return callback(null, exists, null, conflict);
      }

      self._removeParents(username, path, function() {
        release();
        callback(null, true, modified);
      });
    });
  });
};

FileTree.prototype._delete = function(username, pathname, version, callback) {
  var dataPath = path.join(this._dir, this.dataPath(username, pathname)),
      metaPath = path.join(this._dir, this.metaPath(username, pathname));

  this.getCurrentState(dataPath, version, function(error, current, modified) {
    if (error || !current)
      return callback(false, null, !current);

    fs.unlink(dataPath, function(error) {
      fs.unlink(metaPath, function(error) {
        callback(!error, modified);
      });
    });
  });
};

FileTree.prototype._removeParents = function(username, pathname, callback) {
  var self     = this,
      query    = core.parsePath(pathname),
      filename = query.pop(),
      parents  = core.parents(pathname);

  async.forEachSeries(parents, function(parent, done) {
    var dirname = self.dirname(username, parent);

    self.childPaths(username, parent, function(entries) {
      if (entries.length === 0) {
        fs.rmdir(dirname, done);
      } else {
        var modified = new Date();
        self.touch(dirname, modified.getTime(), done);
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

  fs.stat(fullPath, function(error, stat) {
    fs.readFile(fullPath, function(error, content) {
      writer(error, error ? null : content.toString(), function(newContent, callback) {
        if (newContent === null) return callback(null, !!stat);

        self.writeBlob(fullPath, newContent, function(error) {
          callback(error, !!stat);
        });
      });
    });
  });
};

FileTree.prototype.getCurrentState = function(fullPath, version, callback) {
  fs.stat(fullPath, function(error, stat) {
    var mtime = stat && new Date(stat.mtime.getTime()).getTime();
    if (!version) return callback(null, true, mtime);
    if (version === '*') return callback(null, !mtime);
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

var REWRITE_PATTERNS = [
  [/^\.([^~]*)\.(json|meta)$/, '.~$1'],
  [/^([^~]*)\.d$/,             '$1~' ],
  [/^([^~]*)\.blob$/,          '$1'  ]
];

FileTree.prototype._renameLegacyFiles = function() {
  var self = this;

  fs.readdir(self._dir, function(error, entries) {
    if (error) return;

    entries.forEach(function(entry) {
      fs.readdir(path.join(self._dir, entry), function(error, users) {
        if (error) return;

        users.forEach(function(username) {
          self._lock(username, function(release) {
            var pathname = path.join(self._dir, entry, username, 'storage');
            rename(pathname, REWRITE_PATTERNS, release);
          });
        });
      });
    });
  });
};

module.exports = FileTree;
