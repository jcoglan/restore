var fs    = require('fs'),
    path  = require('path'),
    async = require('async');

var rename = function(pathname, pattern, replacement, callback) {
  var dirname  = path.dirname(pathname),
      basename = path.basename(pathname),
      newName  = basename.replace(pattern, replacement);

  if (newName !== basename) {
    fs.rename(pathname, path.join(dirname, newName), callback);
    // console.log(pathname, '---->', path.join(dirname, newName));
  } else {
    callback();
  }
};

var traverse = function(pathname, root, pattern, replacement, callback) {
  fs.stat(pathname, function(error, stat) {
    if (error) return callback(error);
    if (stat.isFile()) return rename(pathname, pattern, replacement, callback);
    if (!stat.isDirectory()) return callback(new Error());

    fs.readdir(pathname, function(error, entries) {
      async.forEach(entries, function(entry, next) {
        traverse(path.join(pathname, entry), false, pattern, replacement, next);
      }, function(error) {
        if (error) return callback(error);
        if (root) return callback();
        rename(pathname, pattern, replacement, callback);
      });
    });
  });
};

var batchRename = function(pathname, renames, callback) {
  async.forEachSeries(renames, function(pair, next) {
    traverse(pathname, true, pair[0], pair[1], next);
  }, callback);
};

module.exports = batchRename;
