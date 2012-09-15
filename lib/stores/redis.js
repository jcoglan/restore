var AES  = require('vault/node/aes'),
    core = require('./core');

var RedisStore = function(options) {
  this._options = options || {};
  
  var redis  = require('redis'),
      host   = this._options.host     || this.DEFAULT_HOST,
      port   = this._options.port     || this.DEFAULT_PORT,
      db     = this._options.database || this.DEFAULT_DATABASE,
      auth   = this._options.password,
      socket = this._options.socket;
  
  this._ns  = this._options.namespace || '';
  
  this._redis = socket
              ? redis.createClient(socket, {no_ready_check: true})
              : redis.createClient(port, host, {no_ready_check: true});
  
  if (auth) this._redis.auth(auth);
  this._redis.select(db);
};

RedisStore.prototype.DEFAULT_HOST = 'localhost';
RedisStore.prototype.DEFAULT_PORT = 6379;
RedisStore.prototype.DEFAULT_DATABASE = 0;

RedisStore.prototype.redisFor = function(username) {
  return this._redis; // TODO: support sharding
};

RedisStore.prototype.authPath = function(username) {
  return this._ns + 'users|' + username + '|auth';
};

RedisStore.prototype.permissionPath = function(username, clientId, category) {
  category = category.replace(/^\/?/, '/').replace(/\/?$/, '/');
  return this._ns + 'users|' + username + '|clients|' + clientId + '|permissions|' + category;
};

RedisStore.prototype.createUser = function(params, callback) {
  var self   = this,
      errors = core.validateUser(params);
  
  if (errors.length > 0) return callback(errors[0]);
  
  core.hashPassword(params.password, null, function(error, hash) {
    self.redisFor(params.username).hsetnx(self.authPath(params.username), 'key', hash.key, function(error, set) {
      if (!set) return callback(new Error('The username is already taken'));
      
      var command = [self.authPath(params.username)],
          client  = self.redisFor(params.username);
      
      for (var key in hash) {
        command.push(key);
        command.push(String(hash[key]));
      }
      command.push(function() { callback(null) });
      client.hmset.apply(client, command);
    });
  });
};

RedisStore.prototype.authenticate = function(params, callback) {
  var username = params.username || '';
  this.redisFor(username).hgetall(this.authPath(username), function(error, hash) {
    if (hash === null) return callback(new Error('Username not found'));
    
    var key = hash.key;
    
    core.hashPassword(params.password, hash, function(error, hash) {
      if (hash.key === key)
        callback(null);
      else
        callback(new Error('Incorrect password'));
    });
  });
};

RedisStore.prototype.authorize = function(clientId, username, permissions, callback) {
  var self = this;
  
  for (var category in permissions) {
    for (var i = 0, n = permissions[category].length; i < n; i++) {
      this.redisFor(username).sadd(this.permissionPath(username, clientId, category), permissions[category][i]);
    }
  }
  this.redisFor(username).hget(this.authPath(username), 'key', function(error, key) {
    var aes = new AES(key);
    aes.encrypt(clientId, callback);
  });
};

RedisStore.prototype.checkToken = function(token, username, path, permission, callback) {
  if (!token) return callback(this.error('Invalid access token', 401));
  
  path = path.replace(/^\/public\//, '/');
  
  var client = this.redisFor(username),
      self   = this;
  
  this.redisFor(username).hget(this.authPath(username), 'key', function(error, key) {
    if (!key) return callback(self.error('Invalid access token', 401));
    
    var aes = new AES(key);
    
    aes.decrypt(token, function(error, clientId) {
      if (error) return callback(self.error('Invalid access token', 401));
      
      core.asyncEach(core.parents(path, true), function(parent, i, done) {
        var key = self.permissionPath(username, clientId, parent);
        client.sismember(key, permission, function(error, allowed) {
          if (allowed === 1)
            callback(null);
          else
            done();
        });
      }, function() {
        callback(self.error('Invalid access token', 403));
      });
    });
  });
};

RedisStore.prototype.error = function(message, status) {
  var error = new Error(message);
  error.status = status;
  return error;
};

RedisStore.prototype.get = function(token, username, path, callback) {
  var self   = this,
      isdir  = /\/$/.test(path),
      client = this.redisFor(username);
  
  this.checkToken(token, username, path, 'r', function(error) {
    if (error && (!/^\/public\//.test(path) || isdir)) return callback(error);
    
    var key = self._ns + 'users|' + username + '|data|' + path;
    if (isdir) {
      client.smembers(key + '|children', function(error, children) {
        core.asyncMap(children.sort(), function(child, i, callback) {
          client.hget(key + child + '|item', 'modified', function(error, modified) {
            callback({name: child, modified: new Date(parseInt(modified, 10))});
          });
          
        }, function(listing) { callback(null, listing) });
      });
    } else {
      client.hgetall(key + '|item', function(error, hash) {
        if (hash) hash.modified = new Date(parseInt(hash.modified, 10));
        callback(error, hash);
      });
    }
  });
};

RedisStore.prototype.put = function(token, username, path, type, value, callback) {
  var self   = this,
      query  = core.parsePath(path),
      name   = query.pop(),
      isdir  = /\/$/.test(name),
      client = this.redisFor(username);
  
  this.checkToken(token, username, path, 'w', function(error) {
    if (error) return callback(error);
    if (isdir) return callback(null, false);
    
    self._lock(username, function(release) {
      var modified = new Date();
      
      core.asyncEach(query, function(q, i, done) {
        var key = self._ns + 'users|' + username + '|data|' + query.slice(0, i+1).join('');
        client.hset(key + '|item', 'modified', modified.getTime(), function() {
          client.sadd(key + '|children', query[i+1] || name, done);
        });
        
      }, function() {
        var key = self._ns + 'users|' + username + '|data|' + path + '|item';
        client.exists(key, function(error, exists) {
          client.hmset(key, {type: type, modified: String(modified.getTime()), value: value}, function(error) {
            release();
            callback(error, !exists, modified);
          });
        });
      });
    });
  });
};

RedisStore.prototype.delete = function(token, username, path, callback) {
  var self   = this,
      query  = core.parsePath(path),
      name   = query.pop(),
      isdir  = /\/$/.test(name),
      client = this.redisFor(username),
      self   = this;
  
  this.checkToken(token, username, path, 'w', function(error) {
    if (error) return callback(error);
    if (isdir) return callback(null, false);
    
    self._lock(username, function(release) {
      var key = self._ns + 'users|' + username  + '|data|' + path + '|item';
      
      client.exists(key, function(error, exists) {
        client.del(key, function(error) {
          var key = self._ns + 'users|' + username + '|data|' + query.join('');
          client.srem(key + '|children', name, function() {
            var parents = core.parents(path);
            
            core.asyncSeq(parents, function(parent, i, done) {
              var root   = 'users|' + username + '|data|',
                  key    = root + parents[i-1],
                  parent = root + parent;
              
              client.smembers(key + '|children', function(error, children) {
                if (children.length === 0) {
                  client.del(key + '|item', function() {
                    client.srem(parent + '|children', query[query.length - i], done);
                  });
                } else {
                  self._updateMtime(client, key, children, done);
                }
              });
              
            }, function() {
              release();
              callback(error, exists);
            });
          });
        });
      });
    });
  });
};

RedisStore.prototype._updateMtime = function(client, key, children, callback) {
  core.asyncMap(children, function(child, i, callback) {
    client.hget(key + child, 'modified', function(error, modified) {
      callback(parseInt(modified, 10));
    });
  }, function(mtimes) {
    client.hset(key, 'modified', Math.max.apply(Math, mtimes), callback);
  });
};

RedisStore.prototype._lock = function(username, callback) {
  var lockKey     = this._ns + 'locks|' + username,
      currentTime = new Date().getTime(),
      expiry      = currentTime + 10000 + 1,
      client      = this.redisFor(username),
      self        = this;
  
  var releaseLock = function() {
    if (new Date().getTime() < expiry) client.del(lockKey);
  };
  
  var retry = function() {
    setTimeout(function() { self._lock(username, callback) }, 100);
  };
  
  client.setnx(lockKey, expiry, function(error, set) {
    if (set === 1) return callback(releaseLock);
    
    client.get(lockKey, function(error, timeout) {
      if (!timeout) return retry();
      
      var lockTimeout = parseInt(timeout, 10);
      if (currentTime < lockTimeout) return retry();
      
      client.getset(lockKey, expiry, function(error, oldValue) {
        if (oldValue === timeout)
          callback(releaseLock);
        else
          retry();
      });
    });
  });
};

module.exports = RedisStore;

