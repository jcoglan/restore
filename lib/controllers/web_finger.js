var WebFinger = require('./base').inherit();

WebFinger.OAUTH_VERSION    = 'http://tools.ietf.org/html/rfc6749#section-4.2';
WebFinger.PROTOCOL_VERSION = 'draft-dejong-remotestorage-01';

WebFinger.action('hostMeta', function(extension) {
  var resource = this.params.resource,
      origin   = this.getOrigin(),
      xml      = (extension === '.xml'),
      response;

  if (!resource) {
    response = {
      'links': [ {
        'rel': 'lrdd',
        'template': origin + '/webfinger/' + (xml ? 'xrd' : 'jrd') + '?resource={uri}'
      } ]
    };
    if (xml)
      this.renderXRD('host.xml', response);
    else
      this.renderJSON(response);

    return;
  }

  var user = resource.replace(/^acct:/, '').split('@')[0];

  response = {
    'links': [ {
      'href': origin + '/storage/' + user,
      'rel':  'remotestorage',
      'type': WebFinger.PROTOCOL_VERSION,
      'properties': {
        'auth-method':    WebFinger.OAUTH_VERSION,
        'auth-endpoint':  origin + '/oauth/' + user,
        'http://remotestorage.io/spec/version': WebFinger.PROTOCOL_VERSION
      }
    } ]
  };

  response.links[0].properties[WebFinger.OAUTH_VERSION] =
      response.links[0].properties['auth-endpoint'];

  if (xml)
    this.renderXRD('resource.xml', response);
  else
    this.renderJSON(response);
});

WebFinger.action('account', function(type) {
  var resource = this.params.resource,
      user     = resource.replace(/^acct:/, '').split('@')[0],
      origin   = this.getOrigin();

  var response = {
    'links': [ {
      'rel':      'remoteStorage',
      'api':      'simple',
      'auth':     origin + '/oauth/' + user,
      'template': origin + '/storage/' + user + '/{category}'
    } ]
  };

  if (type === 'xrd')
    this.renderXRD('account.xml', response);
  else
    this.renderJSON(response);
});

WebFinger.prototype.getOrigin = function() {
  var scheme = (this.request.secure || this.server._forceSSL) ? 'https' : 'http',
      host   = this.request.headers['x-forwarded-host'] || this.request.headers.host;

  return scheme + '://' + host;
};

module.exports = WebFinger;
