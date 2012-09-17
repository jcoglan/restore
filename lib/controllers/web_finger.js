var WebFinger = require('./base').inherit();

WebFinger.action('wellKnown', function(extension) {
  var resource = this.params.resource,
      user;
  
  if (extension === '.json') {
    if (resource) {
      user = resource.replace(/^acct:/, '').split('@')[0];    
      this.renderJSON('host-meta.json', {
        auth_url:     'http://localhost/oauth/' + user,
        storage_url:  'http://localhost/storage/' + user
      });
    } else {
      this.response.writeHead(404, {'Access-Control-Allow-Origin': '*'});
      this.response.end();
    }
  } else {
    this.renderXRD('host-meta.xml', {
      template_url: 'http://localhost/webfinger/xrd/{uri}'
    });
  }
});

WebFinger.action('account', function(resource) {
  this.renderXRD('acct.xml', {
    auth_url:     'http://localhost/oauth/' + resource,
    template_url: 'http://localhost/storage/' + resource + '/{category}'
  });
});

module.exports = WebFinger;

