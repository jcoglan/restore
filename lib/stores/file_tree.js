var File = require('./file'),
    core = require('./core'),
    fs   = require('fs'),
    path = require('path'),
    util = require('util');

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
    if (error) return callback([]);
    entries = entries.filter(function(p) { return /\.json$/.test(p) }).sort();
    callback(entries);
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
    this.readFile(self.dataPath(username, path + '.f'), function(error, json) {
      if (error) return callback(null, null);
      var record = JSON.parse(json);
      if (record.modified) record.modified = new Date(record.modified);
      callback(null, record);
    });
  }
};

FileTree.prototype._getListing = function(username, _path, entry, callback) {
  var fullPath = path.join(this.dirname(username, _path), entry);
  fs.readFile(fullPath, function(error, json) {
    var record = JSON.parse(json.toString());
    callback({
      name:     entry.replace(/\.f\.json$/, '').replace(/\.m\.json$/, '/'),
      modified: new Date(record.modified)
    });
  });
};

FileTree.prototype.put = function(username, path, type, value, callback) {
  var self  = this,
      query = core.parsePath(path),
      name  = query.pop();
  
  this._lock(username, function(release) {
    var modified = new Date();
    
    core.asyncEach(query, function(q, i, done) {
      var dir = query.slice(0, i+1).join('').replace(/(?:(.)\/)?$/, '$1.m');
      if (dir === '/.m') return done();
      self.writeFile(self.dataPath(username, dir), function(error, json, write) {
        var data = JSON.stringify({modified: modified.getTime()}, true, 2);
        write(data, done);
      });
      
    }, function() {
      self.writeFile(self.dataPath(username, path + '.f'), function(error, json, write) {
        var data = JSON.stringify({type: type, modified: modified.getTime(), value: value}, true, 2);
        write(data, function(error, exists) {
          release();
          
          if (error)
            callback(error);
          else
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
        callback(null, true);
        release();
      });
    });
  });
};

FileTree.prototype._delete = function(username, _path, callback) {
  var fullPath = path.join(this._dir, this.dataPath(username, _path + '.f'));
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
    var dirname = self.dirname(username, parent),
        metadir = dirname.replace(/\.d$/, '.m.json');
    
    self.childPaths(username, parent, function(entries) {
      if (entries.length === 0) {
        fs.rmdir(dirname, function() {
          fs.unlink(metadir, done);
        });
      } else {
        core.asyncMap(entries, function(entry, i, callback) {
          fs.readFile(path.join(dirname, entry), function(error, json) {
            var record = JSON.parse(json.toString());
            callback(record.modified);
          });
        }, function(mtimes) {
          var record = {modified: Math.max.apply(Math, mtimes)},
              dir    = parent.replace(/(?:(.)\/)?$/, '$1.m');
          
          if (dir === '/.m') return done();
          
          self.writeFile(self.dataPath(username, dir), function(error, json, write) {
            write(JSON.stringify(record, true, 2), done);
          });
        });
      }
    });
  }, callback);
};

module.exports = FileTree;

