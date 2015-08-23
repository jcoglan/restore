'use strict';

var crypto = require('crypto');

exports.VALID_PATH = /^\/([a-z0-9\%\.\-\_]+\/?)*$/i;
exports.VALID_NAME = /^[a-z0-9\%\.\-\_]+$/;

exports.indexed = function(list) {
  return list.map(function(v, i) { return {index: i, value: v} });
};

exports.generateToken = function() {
  return crypto.randomBytes(160/8).toString('base64');
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

exports.parents = function(path, includeSelf) {
  var query   = this.parsePath(path),
      parents = [];

  if (includeSelf) parents.push(query.join(''));
  query.pop();

  while (query.length > 0) {
    parents.push(query.join(''));
    query.pop();
  }
  return parents;
};

exports.parsePath = function(path) {
  var query = path.match(/[^\/]*(\/|$)/g);
  return query.slice(0, query.length - 1);
};

exports.validateUser = function(params) {
  var errors   = [],
      username = params.username || '',
      email    = params.email    || '',
      password = params.password || '';

  if (username.length < 2)
    errors.push(new Error('Username must be at least 2 characters long'));

  if (!exports.isValidUsername(username))
    errors.push(new Error('Usernames may only contain letters, numbers, dots, dashes and underscores'));

  if (!email)
    errors.push(new Error('Email must not be blank'));

  if (!/^.+@.+\..+$/.test(email))
    errors.push(new Error('Email is not valid'));

  if (!password)
    errors.push(new Error('Password must not be blank'));

  return errors;
};

exports.isValidUsername = function(username) {
  if ((!username) || (username === '..')) return false;
  return exports.VALID_NAME.test(username);
};
