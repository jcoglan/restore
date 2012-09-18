var WebFinger = require('./base').inherit(function(forceSSL) {
  this._forceSSL = forceSSL;
});

WebFinger.action('wellKnown', function(extension) {
  var resource = this.params.resource,
      host     = this.getOrigin(),
      user;
  
  if (extension === '.json') {
    if (resource) {
      user = resource.replace(/^acct:/, '').split('@')[0];
      this.renderJSON('host-meta.json', {
        auth_url:     host + '/oauth/' + user,
        storage_url:  host + '/storage/' + user
      });
    } else {
      this.response.writeHead(404, {'Access-Control-Allow-Origin': '*'});
      this.response.end();
    }
  } else {
    this.renderXRD('host-meta.xml', {
      template_url: host + '/webfinger/xrd/{uri}'
    });
  }
});

WebFinger.action('account', function(resource) {
  var user = user = resource.replace(/^acct:/, '').split('@')[0],
      host = this.getOrigin();
  
  this.renderXRD('acct.xml', {
    auth_url:     host + '/oauth/' + user,
    template_url: host + '/storage/' + user + '/{category}'
  });
});

WebFinger.prototype.getOrigin = function() {
  var scheme = (this.request.secure || this._forceSSL) ? 'https' : 'http';
  return scheme + '://' + this.request.headers.host;
};

module.exports = WebFinger;

