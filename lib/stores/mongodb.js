var async = require('async'),
    core  = require('./core');

var MongoDbStore = function(options) {
  this._options = options || {};
  this._client = null;

  var MongoClient    = require('mongodb').MongoClient,
      host           = this._options.host     || this.DEFAULT_HOST,
      port           = this._options.port     || this.DEFAULT_PORT,
      db             = this._options.database || this.DEFAULT_DATABASE,
      username       = this._options.username,
      password       = this._options.password,
      clientQueue    = [];
      creatingClient = false,
      self           = this,
      connstr        = null;

  if (username && password) {
    connstr = 'mongodb://' + username + ':' + password + '@' + host + ':' + port + '/' + db;
  } else {
    connstr = 'mongodb://' + host + ':' + port + '/' + db;
  }

  this.getClient = function(callback) {
    var self = this;
    if (this._client !== null) {
      callback(null, this._client);
    } else {
      clientQueue.push(callback);
      if (creatingClient === false) {
        creatingClient = true;
        MongoClient.connect(connstr, function(error, client) {
          if (error !== null) {
            callback(error, null);
          } else {
            self._client = client;
            clientQueue.forEach(function (callback) {
              callback(null, self._client);
            });
            clientQueue = [];
            creatingClient = false;
          }
        });
      }
    }
  };

};

MongoDbStore.prototype.DEFAULT_HOST = 'localhost';
MongoDbStore.prototype.DEFAULT_PORT = 27017;
MongoDbStore.prototype.DEFAULT_DATABASE = 'restore';

MongoDbStore.prototype.createUser = function(params, callback) {
  var errors = core.validateUser(params);
  if (errors.length > 0) {
    callback(errors[0]);
  } else {
    this.getClient(function(error, client) {
      core.hashPassword(params.password, null, function(error, password) {
        client.collection('users', function(error, collection) {
          collection.find({
            username: params.username
          }, {
            limit: 1
          }).count(true, function(error, exists) {
            if (exists === 1) {
              callback(new Error('The username is already taken'));
            } else {
              collection.insert({
                username: params.username,
                password: password,
                email: params.email
              }, function() {
                callback(null);
              });
            }
          });
        });
      });
    });
  }
};

MongoDbStore.prototype.authenticate = function(params, callback) {
  var username = params.username || '';
  this.getClient(function(error, client) {
    client.collection('users', function(error, collection) {
      collection.findOne({
        username: username
      }, function(error, user) {
        if (user === null) {
          callback(new Error('Username not found'));
        } else {
          var key = user.password.key;
          core.hashPassword(params.password, user.password, function(error, password) {
            if (password.key === key) {
              callback(null);
            } else {
              callback(new Error('Incorrect password'));
            }
          });
        }
      });
    });
  });
};

MongoDbStore.prototype.authorize = function(clientId, username, permissions, callback) {
  var token  = core.generateToken();
  this.getClient(function(error, client) {
    client.collection('sessions', function(error, collection) {
      collection.insert({
        username: username,
        token: token,
        permissions: permissions
      }, function(error) {
        if (error !== null) {
          callback(error, null);
        } else {
          callback(null, token);
        }
      });
    });
  });
};

MongoDbStore.prototype.revokeAccess = function(username, token, callback) {
  callback = callback || function() {};
  this.getClient(function(error, client) {
    client.collection('sessions', function(error, collection) {
      collection.remove({
        username: username,
        token: token
      }, callback);
    });
  });
};

MongoDbStore.prototype.permissions = function(username, token, callback) {
  this.getClient(function(error, client) {
    client.collection('sessions', function(error, collection) {
      collection.findOne({
        username: username,
        token: token
      }, function(error, session) {
        if (error !== null || session === null) {
          callback(error, {});
        } else {
          // Normalize permissions: folder -> /folder/
          var permissions = {};
          Object.keys(session.permissions).forEach(function(permission) {
            permissions[permission.replace(/^\/?/, '/').replace(/\/?$/, '/')] = session.permissions[permission];
          });
          callback(null, permissions);
        }
      });
    });
  });
};

MongoDbStore.prototype.get = function(username, path, version, callback) {
  var isdir  = /\/$/.test(path);
  var fields;
  if (isdir === true) {
    fields = {
      children: 1
    };
  } else {
    fields = {
      modified: 1,
      type: 1,
      value: 1
    };
  }
  this.getClient(function(error, client) {
    client.collection('nodes', function(error, collection) {
      collection.findOne({
        name: path,
        username: username
      }, fields, function(error, node) {
        if (error !== null || node === null) {
          callback(error, null, false);
        } else {
          // Do not expose MongoDB stuff
          delete node._id;
          if (isdir === true) {
            node.children = node.children.map(function(child) {
              child.modified = parseInt(child.modified, 10);
              return child;
            });
            callback(error, node.children);
          } else {
            node.modified = parseInt(node.modified, 10);
            node.value = node.value.buffer;
            callback(error, node, version === node.modified);
          }
        }
      });
    });
  });
};

MongoDbStore.prototype.put = function(username, path, type, value, version, callback) {
  var self         = this,
      query        = core.parsePath(path),
      documentName = query.pop();
  this.getClient(function(error, client) {
    client.collection('nodes', function(error, collection) {
      self.isCurrentVersion(collection, path, username, version, function(error, iscurrent) {
        if (error || !iscurrent) {
          callback(error, false, null, true);
        } else {
          var modified = new Date().getTime().toString().replace(/...$/, '000');
          async.forEach(core.indexed(query), function(entry, done) {
            var folderName = query.slice(0, entry.index + 1).join(''),
                childName  = query[entry.index + 1] || documentName;
            collection.update({
              name: folderName,
              username: username
            }, {
              $set: {
                modified: modified
              },
              $addToSet: {
                children: {
                  name: childName
                }
              }
            }, {
              upsert: true
            }, function(error, result) {
              collection.update({
                name: folderName,
                username: username,
                'children.name': childName
              }, {
                $set: {
                  'children.$.modified': modified
                }
              }, function(error, result) {
                done();
              });
            });
          }, function() {
            collection.update({
              name: path,
              username: username
            }, {
              $set: {
                modified: modified,
                type: type,
                value: value
              }
            }, {
              upsert: true
            }, function(error, result, status) {
              callback(error, !status.updatedExisting, parseInt(modified, 10));
            });
          });
        }
      });
    });
  });
};

MongoDbStore.prototype.delete = function(username, path, version, callback) {
  var self         = this,
      query        = core.parsePath(path),
      documentName = query.pop(),
      parentFolder = query.join('');
  this.getClient(function(error, client) {
    client.collection('nodes', function(error, collection) {
      self.isCurrentVersion(collection, path, username, version, function(error, iscurrent, modified) {
        if (error || !iscurrent) {
          callback(error, false, null, true);
        } else {
          // Remove document
          collection.remove({
            name: path,
            username: username
          }, function(error, numRemoved) {
            if (numRemoved === 0) {
              callback(error, false, modified);
            } else {
              // Remove document from parent folder
              collection.update({
                name: parentFolder,
                username: username
              }, {
                $pull: {
                  children: {
                    name: documentName
                  }
                }
              }, function(error) {
                self._removeParents(collection, username, path, function() {
                  callback(error, true, modified);
                });
              });
            }
          });
        }
      });
    });
  });
};

MongoDbStore.prototype.isCurrentVersion = function(collection, path, username, version, callback) {
  collection.findOne({
    name: path,
    username: username
  }, {
    modified: 1
  }, function(error, node) {
    if (error !== null) {
      callback(error, false);
    } else {
      var mtime = node && parseInt(node.modified, 10);
      if (!version) {
        callback(null, true, mtime);
      } else {
        callback(null, mtime === version, mtime);
      }
    }
  });
};

MongoDbStore.prototype._removeParents = function(collection, username, path, callback) {
  var query        = core.parsePath(path),
      documentName = query.pop(),
      parents      = core.parents(path);
  async.forEachSeries(core.indexed(parents), function(entry, done) {
    var parentFolder  = entry.value,
        i             = entry.index,
        currentFolder = parents[i - 1];
    // Skip the first one
    if (i === 0) {
      done();
    } else {
      // Find out if folder has children
      collection.findOne({
        name: currentFolder,
        username: username
      }, {
        children: 1
      }, function(error, node) {
        if (node.children.length === 0) {
          // Remove empty folder
          collection.remove({
            name: currentFolder,
            username: username
          }, function(error) {
            // Remove empty folder from parent
            collection.update({
              name: parentFolder,
              username: username
            }, {
              $pull: {
                children: {
                  name: query[query.length - i]
                }
              }
            }, function(error) {
              done();
            });
          });
        } else {
          self._updateMtime(collection, currentFolder, username, node.children, done);
        }
      });
    }
  }, callback);
};

MongoDbStore.prototype._updateMtime = function(collection, path, username, children, callback) {
  async.map(children, function(child, callback) {
    collection.findOne({
      name: path + child.name,
      username: username
    }, {
      modified: 1
    }, function(error, node) {
      callback(error, parseInt(node.modified, 10));
    });
  }, function(error, mtimes) {
    collection.update({
      name: path,
      username: username
    }, {
      $set: {
        modified: Math.max.apply(Math, mtimes)
      }
    }, callback);
  });
};

module.exports = MongoDbStore;

