'use strict';

var path = require('path');

var Assets = require('./base').inherit();

var assetDir = __dirname + '/../assets/';

Assets.TYPES = {
  '.css': 'text/css',
  '.js' : 'application/javascript',
  '.svg': 'image/svg+xml'
};

Assets.action('serve', function(filename) {
  var content = this.readFile(assetDir + filename),
      type    = Assets.TYPES[path.extname(filename)];

  if (content) {
    this.response.writeHead(200, {
      'Content-Length': content.length,
      'Content-Type':   type
    });
    this.response.end(content);
  } else {
    this.errorPage(404, 'Not found');
  }
});

module.exports = Assets;
