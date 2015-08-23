'use strict';

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
  var prefix = this._ns + 'users:' + username;
  if (token === undefined) return prefix + ':clients';
  if (category === undefined) return prefix + ':clients:' + token;
  category = category.replace(/^\/?/, '/').replace(/\/?$/, '/');
  return prefix + ':clients:' + token + ':permissions:' + category;
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
  var self   = this,
      client = this.redisFor(username),
      token  = core.generateToken(),
      multi  = client.multi();

  multi.sadd(this.permissionPath(username), token);

  Object.keys(permissions).map(function (category, n) {
    multi.set(self.permissionPath(username, token) + ':clientId', clientId);
    multi.sadd(self.permissionPath(username, token), category);
    permissions[category].forEach(function(perms, i) {
      multi.sadd(self.permissionPath(username, token, category), perms);
    });
  });

  multi.exec(function() {
    callback(null, token);
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

RedisStore.prototype.get = function(username, pathname, version, callback) {
  var self   = this,
      isdir  = /\/$/.test(pathname),
      client = this.redisFor(username);

  var key = self._ns + 'users:' + username + ':data:' + pathname;
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

RedisStore.prototype.put = function(username, pathname, type, value, version, callback) {
  var self     = this,
      query    = core.parsePath(pathname),
      filename = query.pop(),
      client   = this.redisFor(username),
      dataKey  = this._ns + 'users:' + username + ':data:' + pathname;

  this._lock(username, function(release) {
    self.getCurrentState(client, dataKey, version, function(error, current, mtime) {
      if (error || !current) {
        release();
        return callback(error, false, null, !current);
      }

      var modified = new Date().getTime().toString().replace(/...$/, '000'),
          multi    = client.multi();

      core.indexed(query).forEach(function(q, i) {
        var key = self._ns + 'users:' + username + ':data:' + query.slice(0, i+1).join('');
        multi.hset(key, 'modified', modified);
        multi.sadd(key + ':children', query[i+1] || filename);
      });

      multi.hmset(dataKey, {length: value.length, type: type, modified: modified, value: value.toString('base64')});

      multi.exec(function(error) {
        release();
        callback(error, !mtime, parseInt(modified, 10));
      });
    });
  });
};

RedisStore.prototype.delete = function(username, pathname, version, callback) {
  var self    = this,
      query   = core.parsePath(pathname),
      parents = core.parents(pathname),
      client  = this.redisFor(username),
      prefix  = this._ns + 'users:' + username + ':data:',
      dataKey = prefix + pathname;

  this._lock(username, function(release) {
    self.getCurrentState(client, dataKey, version, function(error, current, mtime) {
      if (error || !current) {
        release();
        return callback(error, false, null, !current);
      }

      async.waterfall([
        function(next) {
          async.map(parents, function(parent, callback) {
            client.smembers(prefix + parent + ':children', callback);
          }, next);
        }, function(children, next) {
          var empty = [], index = 0, remaining;

          while (index < parents.length && children[index].length === 1) {
            empty.push(parents[index]);
            index += 1;
          }

          remaining = parents.slice(index);

          next(error, index, empty, remaining);

        }, function(index, empty, remaining, next) {
          var multi    = client.multi(),
              modified = new Date().getTime().toString().replace(/...$/, '000'),
              item;

          if (remaining.length > 0) {
            item = query[query.length - empty.length - 1];
            multi.srem(prefix + remaining[0] + ':children', item);
          }

          remaining.forEach(function(dir) {
            multi.hset(prefix + dir, 'modified', modified);
          });

          empty.forEach(function(parent) {
            var key = prefix + parent;
            multi.del(key);
            multi.del(key + ':children');
          });

          multi.del(dataKey);
          multi.exec(next);
        }
      ], function(error) {
        release();
        callback(error, !!mtime, mtime);
      });
    });
  });
};

RedisStore.prototype.getCurrentState = function(client, dataKey, version, callback) {
  client.hget(dataKey, 'modified', function(error, modified) {
    if (error) return callback(error, !version, null);

    var mtime = modified && parseInt(modified, 10);
    if (!version) return callback(null, true, mtime);
    if (version === '*') return callback(null, !mtime);

    callback(null, mtime === version, mtime);
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
