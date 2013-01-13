var WebFinger = require('./base').inherit(function(forceSSL) {
  this._forceSSL = forceSSL;
});

WebFinger.action('wellKnown', function(extension) {
  var resource = this.params.resource,
      host     = this.getOrigin(),
      user;

  if (!resource) {
    if (!extension) {
      this.renderXRD('host-meta.xml', {template_url: host + '/webfinger/xrd/{uri}'});
    } else {
      this.response.writeHead(404, {'Access-Control-Allow-Origin': '*'});
      this.response.end();
    }
    return;
  }

  var user = resource.replace(/^acct:/, '').split('@')[0];

  var locals = {
    resource:     resource,
    auth_url:     host + '/oauth/' + user,
    storage_url:  host + '/storage/' + user
  };

  if (extension === '.json')
    this.renderJSON('host-meta.json', locals);
  else
    this.renderJSON('resource.json', locals);
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
  var scheme = (this.request.secure || this._forceSSL) ? 'https' : 'http',
      host   = this.request.headers['x-forwarded-host'] || this.request.headers.host;

  return scheme + '://' + host;
};

module.exports = WebFinger;

