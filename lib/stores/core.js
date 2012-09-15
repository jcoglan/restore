var crypto = require('crypto');

exports.asyncEach = function(list, mapper, callback) {
  var n = list.length, m = n;
  if (m === 0) return callback();
  for (var i = 0; i < n; i++)
    (function(item, index) {
      mapper(item, index, function() {
        m -= 1;
        if (m === 0) callback();
      });
    })(list[i], i);
};

exports.asyncMap = function(list, mapper, callback) {
  var result = [];
  this.asyncEach(list, function(item, i, done) {
    mapper(item, i, function(value) {
      result[i] = value;
      done();
    });
  }, function() {
    callback(result);
  });
};

exports.asyncReverseSeq = function(list, mapper, callback) {
  var n = list.length;
  var next = function() {
    if (n === 0) return callback();
    n -= 1;
    mapper(list[n], n, next);
  };
  next();
};

exports.hashRounds = 10000;

exports.hashPassword = function(password, config, callback) {
  config = config || {
    salt:   crypto.randomBytes(16).toString('base64'),
    work:   exports.hashRounds,
    keylen: 64
  };
  
  crypto.pbkdf2(password, config.salt, parseInt(config.work,10), parseInt(config.keylen,10), function(error, key) {
    config.key = new Buffer(key, 'binary').toString('base64');
    callback(error, config);
  });
};

exports.parsePath = function(path) {
  return path.split(/\b(?!\/)/).slice(1);
};

exports.validateUser = function(params) {
  var errors   = [],
      username = params.username || '',
      password = params.password || '';
  
  if (username.length < 2)
    errors.push(new Error('Username must be at least 2 characters long'));
  
  if (!/^[a-z0-9\-\_\.]+$/i.test(username))
    errors.push(new Error('Usernames may only contain letters, numbers, dots, dashes and underscores'));
  
  if (!password)
    errors.push(new Error('Password must not be blank'));
  
  return errors;
};

var Queues = function() {
  this._queues = {};
};

Queues.prototype.get = function(name) {
  return this._queues = this._queues[name] || new Queue(this, name);
};

Queues.prototype.remove = function(name) {
  delete this._queues[name];
};

var Queue = function(container, name) {
  this._container = container;
  this._name      = name;
  this._tasks     = [];
  this._running   = false;
};

Queue.prototype.push = function(task) {
  this._tasks.push(task);
  if (!this._running) this.runNext();
};

Queue.prototype.runNext = function() {
  this._running = true;
  var task = this._tasks.shift();
  
  if (!task) {
    this._running = false;
    this._container.remove(this._name);
    return;
  }
  
  var self = this;
  task(function() { self.runNext() });
};

exports.Queues = Queues;

