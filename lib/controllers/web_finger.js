var WebFinger = require('./base').inherit();

WebFinger.OAUTH_VERSION    = 'http://tools.ietf.org/html/rfc6749#section-4.2';
WebFinger.PROTOCOL_VERSION = 'draft-dejong-remotestorage-01';

WebFinger.action('hostMeta', function(extension) {
  var resource = this.params.resource,
      host     = this.getOrigin(),
      json     = (extension === '.json'),
      response;

  if (!resource) {
    response = {
      'links': [ {
        'rel': 'lrdd',
        'template': host + '/webfinger/' + (json ? 'jrd' : 'xrd') + '?resource={uri}'
      } ]
    };
    if (json)
      this.renderJSON(response);
    else
      this.renderXRD('host.xml', response);

    return;
  }

  var user = resource.replace(/^acct:/, '').split('@')[0];

  var response = {
    'links': [ {
      'href': host + '/storage/' + user,
      'rel':  'remotestorage',
      'type': WebFinger.PROTOCOL_VERSION,
      'properties': {
        'auth-method':    WebFinger.OAUTH_VERSION,
        'auth-endpoint':  host + '/oauth/' + user,
        'http://remotestorage.io/spec/version': WebFinger.PROTOCOL_VERSION
      }
    } ]
  };
  response.links[0].properties[WebFinger.OAUTH_VERSION] =
      response.links[0].properties['auth-endpoint'];

  if (extension === '.json')
    this.renderJSON(response);
  else
    this.renderXRD('resource.xml', response);
});

WebFinger.action('account', function(type, resource) {
  var user = this.params.resource.replace(/^acct:/, '').split('@')[0],
      host = this.getOrigin();

  var response = {
    'links': [ {
      'rel':      'remoteStorage',
      'api':      'simple',
      'auth':     host + '/oauth/' + user,
      'template': host + '/storage/' + user + '/{category}'
    } ]
  };

  if (type === 'jrd')
    this.renderJSON(response);
  else
    this.renderXRD('account.xml', response);
});

WebFinger.action('rfc7033', function(type, resource) {
  var user = this.params.resource.replace(/^acct:/, '').split('@')[0],
      scheme = (this.request.secure || this.server._forceSSL) ? 'https' : 'http',
      host   = (this.request.headers['x-forwarded-host'] || this.request.headers.host).split(':')[0],
      port = this.server.getStoragePort(),
      authUrl = scheme + '://' + host + ':' + port + '/oauth/' + user,
      link = require('remotestorage-server').createServer(WebFinger.PROTOCOL_VERSION).getWebfingerLink(scheme, host, port, user, authUrl),
      response = {
        'links': [ link ]
      };

  this.renderJSON(response);
});

WebFinger.prototype.getOrigin = function() {
  var scheme = (this.request.secure || this.server._forceSSL) ? 'https' : 'http',
      host   = this.request.headers['x-forwarded-host'] || this.request.headers.host;

  return scheme + '://' + host;
};

module.exports = WebFinger;

