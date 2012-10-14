var File  = require('./file'),
    core  = require('./core'),
    fs    = require('fs'),
    path  = require('path'),
    util  = require('util');

var FileTree = function() {
  File.apply(this, arguments);
};
util.inherits(FileTree, File);

FileTree.prototype.dataPath = function(username, _path) {
  var query = core.parsePath(_path).slice(1),
      name  = query.pop() || '',
      dir   = query.map(function(q) { return q.replace(/\/$/, '.d') }).join('/');
  
  return path.join(username.substr(0,2), username, 'storage', dir, name + '.json');
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
  var self  = this,
      isdir = /\/$/.test(path);
  
  if (isdir) {
    this._lock(username, function(release) {
      self.childPaths(username, path, function(entries) {
        core.asyncMap(entries, function(entry, i, callback) {
          self._getListing(username, path, entry, callback);
        }, function(listing) {
          release();
          callback(null, listing);
        });
      });
    });
  } else {
    this.readFile(self.dataPath(username, path), function(error, json, modified) {
      if (error) return callback(null, null);
      var record = JSON.parse(json);
      record.modified = modified;
      record.value = new Buffer(record.value);
      callback(null, record);
    });
  }
};

FileTree.prototype._getListing = function(username, _path, entry, callback) {
  var fullPath = path.join(this.dirname(username, _path), entry);
  fs.stat(fullPath, function(error, stat) {
    callback({
      name:     entry.replace(/\.(d|json)$/, function(_,m) { return m === 'd' ? '/' : '' }),
      modified: stat.mtime
    });
  });
};

FileTree.prototype.put = function(username, path, type, value, callback) {
  var self  = this,
      query = core.parsePath(path),
      name  = query.pop();
  
  this._lock(username, function(release) {
    var modified = new Date();
    
    self.writeFile(self.dataPath(username, path), function(error, json, write) {
      var data = JSON.stringify({type: type, value: value.toString()}, true, 2);
      write(data, function(error, exists) {
        release();
        if (error) return callback(error);
        
        core.asyncEach(query, function(q, i, done) {
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
      if (!exists) return callback(null, false);
      
      self._removeParents(username, path, function() {
        release();
        callback(null, true);
      });
    });
  });
};

FileTree.prototype._delete = function(username, _path, callback) {
  var fullPath = path.join(this._dir, this.dataPath(username, _path));
  fs.unlink(fullPath, function(error) {
    callback(!error);
  });
};

FileTree.prototype._removeParents = function(username, _path, callback) {
  var self    = this,
      query   = core.parsePath(_path),
      name    = query.pop(),
      parents = core.parents(_path);
  
  core.asyncSeq(parents, function(parent, i, done) {
    var dirname = self.dirname(username, parent);
    
    self.childPaths(username, parent, function(entries) {
      if (entries.length === 0) {
        fs.rmdir(dirname, done);
      } else {
        core.asyncMap(entries, function(entry, i, callback) {
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

