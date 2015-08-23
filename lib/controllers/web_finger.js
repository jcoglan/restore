'use strict';

var WebFinger = require('./base').inherit();

WebFinger.OAUTH_VERSION    = 'http://tools.ietf.org/html/rfc6749#section-4.2';
WebFinger.PROTOCOL_VERSION = 'draft-dejong-remotestorage-01';

WebFinger.action('hostMeta', function(pathname, extension) {
  var resource = this.params.resource,
      origin   = this.getOrigin(),
      json     = (extension === '.json'),
      useJRD   = (pathname === 'webfinger'),
      useJSON  = useJRD || (pathname === 'host-meta' && json),
      response;

  if (!resource) {
    response = {
      'links': [ {
        'rel': 'lrdd',
        'template': origin + '/webfinger/' + (useJSON ? 'jrd' : 'xrd') + '?resource={uri}'
      } ]
    };
    if (useJSON)
      this.renderJSON(response, useJRD ? 'jrd+json' : 'json');
    else
      this.renderXRD('host.xml', response);

    return;
  }

  var user = resource.replace(/^acct:/, '').split('@')[0];

  response = {
    'links': [ {
      'href': origin + '/storage/' + user,
      'rel':  'remotestorage',
      'type': WebFinger.PROTOCOL_VERSION,
      'properties': {
        'auth-method': WebFinger.OAUTH_VERSION,
        'auth-endpoint': origin + '/oauth/' + user,
        'http://remotestorage.io/spec/version': WebFinger.PROTOCOL_VERSION,
        'http://tools.ietf.org/html/rfc6750#section-2.3': true
      }
    } ]
  };

  response.links[0].properties[WebFinger.OAUTH_VERSION] =
      response.links[0].properties['auth-endpoint'];

  if (useJSON)
    this.renderJSON(response, 'json');
  else
    this.renderXRD('resource.xml', response);
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
    this.renderJSON(response, 'jrd+json');
});

WebFinger.prototype.getOrigin = function() {
  var scheme = (this.request.secure || this.server._forceSSL) ? 'https' : 'http',
      host   = this.request.headers['x-forwarded-host'] || this.request.headers.host;

  return scheme + '://' + host;
};

module.exports = WebFinger;
