var WebFinger = require('./base').inherit();

WebFinger.action('wellKnown', function(extension) {
  if (extension === '.json') {
    user = this.params.resource.replace(/^acct:/, '').split('@')[0];
    return this.renderJSON('host-meta.json', {
      storage_url:  'http://localhost/data/' + user,
      auth_url:     'http://localhost/auth/' + user
    });
  } else {
    return this.renderXRD('host-meta.xml', {
      template_url: 'http://localhost/webfinger/xrd/{uri}'
    });
  }
});

WebFinger.action('account', function(resource) {
  this.renderXRD('acct.xml', {
    auth_url:     'http://localhost/auth/' + resource,
    template_url: 'http://localhost/data/' + resource + '/{category}'
  });
});

module.exports = WebFinger;

