var async = require('async'),
    core  = require('./core');

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
  return this._ns + 'users:' + username + ':auth';
};

RedisStore.prototype.userPath = function(username) {
  return this._ns + 'users:' + username;
};

RedisStore.prototype.permissionPath = function(username, token, category) {
  var root = this._ns + 'users:' + username;
  if (token === undefined) return root + ':clients';
  if (category === undefined) return root + ':clients:' + token;
  category = category.replace(/^\/?/, '/').replace(/\/?$/, '/');
  return root + ':clients:' + token + ':permissions:' + category;
};

RedisStore.prototype.createUser = function(params, callback) {
  var self   = this,
      errors = core.validateUser(params),
      client = this.redisFor(params.username);

  if (errors.length > 0) return callback(errors[0]);

  core.hashPassword(params.password, null, function(error, hash) {
    client.hsetnx(self.authPath(params.username), 'key', hash.key, function(error, set) {
      if (set === 0) return callback(new Error('The username is already taken'));

      var multi   = client.multi(),
          command = [self.authPath(params.username)];

      for (var key in hash) {
        command.push(key);
        command.push(String(hash[key]));
      }

      multi.hset(self.userPath(params.username), 'email', params.email);
      multi.hmset.apply(multi, command);

      multi.exec(callback);
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
  var client = this.redisFor(username),
      token  = core.generateToken(),
      multi  = client.multi();

  multi.sadd(this.permissionPath(username), token);
  for (var category in permissions) {
    multi.set(this.permissionPath(username, token) + ':clientId', clientId);
    multi.sadd(this.permissionPath(username, token), category);
    permissions[category].forEach(function(perms, i) {
      multi.sadd(this.permissionPath(username, token, category), perms);
    }, this);
  }
  multi.exec(function() {
    callback(null, token)
  });
};

RedisStore.prototype.revokeAccess = function(username, token, callback) {
  callback = callback || function() {};

  var self   = this,
      client = this.redisFor(username);

  client.smembers(self.permissionPath(username, token), function(error, categories) {
    if (error) return callback(error);

    var multi = client.multi();

    categories.forEach(function(dir) {
      multi.del(self.permissionPath(username, token, dir));
    });
    multi.del(self.permissionPath(username, token));

    multi.exec(callback);
  });
};

RedisStore.prototype.permissions = function(username, token, callback) {
  var self   = this,
      output = {},
      client = this.redisFor(username);

  client.smembers(self.permissionPath(username, token), function(error, categories) {
    async.forEach(categories, function(dir, next) {
      client.smembers(self.permissionPath(username, token, dir), function(error, permissions) {
        output[dir.replace(/^\/?/, '/').replace(/\/?$/, '/')] = permissions.sort();
        next();
      });
    }, function() {
      callback(null, output);
    });
  });
};

RedisStore.prototype.clientForToken = function(username, token, callback) {
  this.redisFor(username).hget(this.authPath(username), 'key', function(error, key) {
    if (!key) return callback(new Error());
    var cipher = new Cipher(key);
    cipher.decrypt(token, callback);
  });
};

RedisStore.prototype.error = function(message, status) {
  var error = new Error(message);
  error.status = status;
  return error;
};

RedisStore.prototype._versionMatch = function(version, modified) {
  if (!version || !modified) return false;
  return version === modified;
};

RedisStore.prototype.get = function(username, path, version, callback) {
  var self   = this,
      isdir  = /\/$/.test(path),
      client = this.redisFor(username);

  var key = self._ns + 'users:' + username + ':data:' + path;
  if (isdir) {
    this._lock(username, function(release) {
      client.hget(key, 'modified', function(error, modified) {
        modified = parseInt(modified, 10);
        client.smembers(key + ':children', function(error, children) {
          if (children.length === 0) {
            release();
            return callback(null, null);
          }
          async.map(children.sort(), function(child, callback) {
            client.hget(key + child, 'modified', function(error, modified) {
              callback(error, {name: child, modified: parseInt(modified, 10)});
            });
          }, function(error, listing) {
            release();
            callback(null, {children: listing, modified: modified}, self._versionMatch(version, modified));
          });
        });
      });
    });
  } else {
    client.hgetall(key, function(error, hash) {
      if (hash) {
        hash.length   = parseInt(hash.length, 10);
        hash.modified = parseInt(hash.modified, 10);
        hash.value    = new Buffer(hash.value, 'base64');
      }
      callback(error, hash, self._versionMatch(version, hash && hash.modified));
    });
  }
};

RedisStore.prototype.put = function(username, path, type, value, version, callback) {
  var self    = this,
      query   = core.parsePath(path),
      name    = query.pop(),
      client  = this.redisFor(username),
      dataKey = this._ns + 'users:' + username + ':data:' + path;

  this._lock(username, function(release) {
    self.getCurrentState(client, dataKey, version, function(error, current, mtime, exists) {
      if (error || !current) {
        release();
        return callback(error, false, null, !current);
      }

      var modified = new Date().getTime().toString().replace(/...$/, '000'),
          multi    = client.multi();

      core.indexed(query).forEach(function(q, i) {
        var key = self._ns + 'users:' + username + ':data:' + query.slice(0, i+1).join('');
        multi.hset(key, 'modified', modified);
        multi.sadd(key + ':children', query[i+1] || name);
      });

      multi.hmset(dataKey, {length: value.length, type: type, modified: modified, value: value.toString('base64')});

      multi.exec(function(error) {
        release();
        callback(error, !exists, parseInt(modified, 10));
      });
    });
  });
};

RedisStore.prototype.delete = function(username, path, version, callback) {
  var self    = this,
      query   = core.parsePath(path),
      parents = core.parents(path),
      client  = this.redisFor(username),
      root    = this._ns + 'users:' + username + ':data:',
      dataKey = root + path,
      empty   = [],
      remain;

  this._lock(username, function(release) {
    self.getCurrentState(client, dataKey, version, function(error, current, mtime, exists) {
      if (error || !current) {
        release();
        return callback(error, false, null, !current);
      }

      async.waterfall([
        function(callback) {
          async.map(parents, function(parent, callback) {
            client.smembers(root + parent + ':children', callback);
          }, callback);
        }, function(children, callback) {
          var index = 0;

          while (index < parents.length && children[index].length === 1) {
            empty.push(parents[index]);
            index += 1;
          }
          remain = parents[index];

          children = children[index].filter(function(name) {
            return name !== query[query.length - index - 1];
          });

          async.map(children, function(child, callback) {
            var key = root + remain + child;
            client.hget(key, 'modified', callback);
          }, callback);
        }, function(mtimes, callback) {
          mtimes = mtimes.map(function(t) { return parseInt(t, 10) });

          var mtime = Math.max.apply(Math, mtimes),
              multi = client.multi();

          multi.srem(root + remain + ':children', query[query.length - empty.length - 1]);
          multi.hset(root + remain, 'modified', mtime.toString());

          empty.forEach(function(parent) {
            var key = root + parent;
            multi.del(key);
            multi.del(key + ':children');
          });

          multi.del(dataKey);

          multi.exec(callback);
        }
      ], function(error) {
        release();
        callback(error, exists, mtime);
      });
    });
  });
};

RedisStore.prototype.getCurrentState = function(client, dataKey, version, callback) {
  client.hget(dataKey, 'modified', function(error, modified) {
    if (error || !modified) return callback(error, !version, null, false);

    var mtime = parseInt(modified, 10);
    if (!version) return callback(null, true, mtime, true);

    callback(null, mtime === version, mtime, true);
  });
};

RedisStore.prototype._lock = function(username, callback) {
  var lockKey     = this._ns + 'locks:' + username,
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
