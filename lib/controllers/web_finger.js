var WebFinger = require('./base').inherit(function(forceSSL) {
  this._forceSSL = forceSSL;
});

WebFinger.action('wellKnown', function(extension) {
  var resource = this.params.resource,
      host     = this.getOrigin();

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

  var response = {
    'links': [ {
      'href': host + '/storage/' + user,
      'rel':  'remotestorage',
      'type': 'draft-dejong-remotestorage-00',
      'properties': {
        'auth-method':    'http://tools.ietf.org/html/rfc6749#section-4.2',
        'auth-endpoint':  host + '/oauth/' + user
      }
    } ]
  };

  if (extension === '.json')
    this.renderJSON(response);
  else
    this.renderXRD('xrd.xml', response);
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

