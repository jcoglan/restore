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
  return this._ns + 'users|' + username + '|clients|' + clientId + '|categories|' + category + '|permissions';
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
  var username = (params.username || '').split('@')[0];
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
  var username = username.split('@')[0],
      self     = this;
  
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

RedisStore.prototype.checkToken = function(token, username, category, permission, callback) {
  username = username.split('@')[0];
  category = category.replace(/^public\//, '');
  var self = this;
  
  this.redisFor(username).hget(this.authPath(username), 'key', function(error, key) {
    if (!key) return callback(self.error('Invalid access token', 401));
    
    var aes = new AES(key);
    
    aes.decrypt(token, function(error, clientId) {
      if (error) return callback(self.error('Invalid access token', 401));
      self.redisFor(username).sismember(self.permissionPath(username, clientId, category), permission, function(error, allowed) {
        if (allowed)
          callback(null);
        else
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

RedisStore.prototype.get = function(token, username, category, path, callback) {
  var self     = this,
      username = username.split('@')[0],
      isdir    = /\/$/.test(path),
      client   = this.redisFor(username);
  
  this.checkToken(token, username, category, 'r', function(error) {
    if (error && (!/^public\//.test(category) || isdir)) return callback(error);
    
    var key = 'users|' + username + '|categories|' + category + '|data|' + path;
    if (isdir) {
      client.smembers(key + '|children', function(error, children) {
        core.asyncMap(children.sort(), function(child, i, callback) {
          client.hget(key + child, 'modified', function(error, modified) {
            callback({name: child, modified: new Date(parseInt(modified, 10))});
          });
          
        }, function(listing) { callback(null, listing) });
      });
    } else {
      client.hgetall(key, function(error, hash) {
        if (hash) hash.modified = new Date(parseInt(hash.modified, 10));
        callback(error, hash);
      });
    }
  });
};

RedisStore.prototype.put = function(token, username, category, path, type, value, callback) {
  var self     = this,
      username = username.split('@')[0],
      query    = ['/'].concat(core.parsePath(path)),
      name     = query.pop(),
      isdir    = /\/$/.test(name),
      client   = this.redisFor(username);
  
  this.checkToken(token, username, category, 'w', function(error) {
    if (error) return callback(error);
    if (isdir) return callback(null, false);
    
    var modified = new Date();
    
    // TODO lock the user/category
    
    core.asyncEach(query, function(q, i, done) {
      var key = 'users|' + username + '|categories|' + category + '|data|' + query.slice(0, i+1).join('');
      client.hset(key, 'modified', modified.getTime(), function() {
        client.sadd(key + '|children', query[i+1] || name, done);
      });
      
    }, function() {
      var key = 'users|' + username + '|categories|' + category + '|data|' + path;
      client.exists(key, function(error, exists) {
        client.hmset(key, {type: type, modified: String(modified.getTime()), value: value}, function(error) {
          callback(error, !exists, modified);
        });
      });
    });
  });
};

RedisStore.prototype.delete = function(token, username, category, path, callback) {
  var self     = this,
      username = username.split('@')[0],
      query    = ['/'].concat(core.parsePath(path)),
      name     = query.pop(),
      isdir    = /\/$/.test(name),
      client   = this.redisFor(username),
      self     = this;
  
  this.checkToken(token, username, category, 'w', function(error) {
    if (error) return callback(error);
    if (isdir) return callback(null, false);
    
    // TODO lock the user/category
    
    var key = 'users|' + username + '|categories|' + category + '|data|' + path;
    client.exists(key, function(error, exists) {
      client.del(key, function(error) {
        var key = 'users|' + username + '|categories|' + category + '|data|' + query.join('');
        client.srem(key + '|children', name, function() {
          core.asyncReverseSeq(query, function(q, i, done) {
            var root   = 'users|' + username + '|categories|' + category + '|data|',
                key    = root + query.slice(0, i+1).join(''),
                parent = root + query.slice(0, i).join('');
            
            client.smembers(key + '|children', function(error, children) {
              if (children.length === 0) {
                client.srem(parent + '|children', q, done);
              } else {
                self._updateMtime(client, parent, children, done);
              }
            });
            
          }, function() { callback(error, exists) });
        });
      });
    });
  });
};

RedisStore.prototype._updateMtime = function(client, parent, children, callback) {
  core.asyncMap(children, function(child, i, callback) {
    client.hget(parent + child, 'modified', function(error, modified) {
      callback(parseInt(modified, 10));
    });
  }, function(mtimes) {
    client.hset(parent, 'modified', Math.max.apply(Math, mtimes), callback);
  });
};

module.exports = RedisStore;

