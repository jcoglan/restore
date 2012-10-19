var File  = require('./file'),
    core  = require('./core'),
    fs    = require('fs'),
    path  = require('path'),
    async = require('async'),
    util  = require('util');

var FileTree = function() {
  File.apply(this, arguments);
};
util.inherits(FileTree, File);

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

FileTree.prototype.put = function(username, _path, type, value, _callback) {
  var self  = this,
      query = core.parsePath(_path),
      name  = query.pop();
  
  this._lock(username, function(release) {
    var modified = new Date(),
        dataPath = path.join(self._dir, self.dataPath(username, _path)),
        metaPath = path.join(self._dir, self.metaPath(username, _path));
    
    var callback = function() {
      release();
      _callback.apply(this, arguments);
    };
    
    self.writeBlob(dataPath, value, function(error, exists) {
      if (error) return callback(error);
      
      self.writeBlob(metaPath, JSON.stringify({type: type}, true, 2), function(error, exists) {
        if (error) return callback(error);
        
        async.forEach(core.indexed(query), function(entry, done) {
          var q = entry.value, i = entry.index;
          self.touch(self.dirname(username, query.slice(0, i+1).join('')), modified, done);
        }, function() {
          callback(null, !exists, modified);
        });
      });
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
            callback(stat.mtime);
          });
        }, function(mtimes) {
          var modified = Math.max.apply(Math, mtimes);
          self.touch(dirname, new Date(modified), done);
        });
      }
    });
  }, callback);
};

module.exports = FileTree;

