var path = require('path');

var Assets = require('./base').inherit();

var assetDir = __dirname + '/../assets/';

Assets.TYPES = {
  '.css': 'text/css',
  '.js' : 'application/javascript'
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
    this.response.writeHead(404, {'Content-Type': 'text/plain'});
    this.response.end();
  }
});

module.exports = Assets;

