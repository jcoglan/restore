var RestoreSteps = require("../restore_steps")

JS.Test.describe("WebFinger", function() { with(this) {
  include(RestoreSteps)
  
  before(function() { this.start(4567) })
  after (function() { this.stop() })
  
  define("host", "http://localhost")
  
  it("returns host metadata as XRD", function() { with(this) {
    get( "/.well-known/host-meta", {} )
    
    check_status( 200 )
    check_header( "Access-Control-Allow-Origin", "*" )
    check_header( "Content-Type", "application/xrd+xml" )
    
    check_body( '<?xml version="1.0" encoding="UTF-8"?>\n\
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">\n\
  <Link rel="lrdd"\n\
        type="application/xrd+xml"\n\
        template="' + host + '/webfinger/{uri}" />\n\
</XRD>' )
  }})
  
  it("returns account metadata as XRD", function() { with(this) {
    get( "/webfinger/acct:zebcoe@locog", {} )
    
    check_status( 200 )
    check_header( "Access-Control-Allow-Origin", "*" )
    check_header( "Content-Type", "application/xrd+xml" )
    
    check_body( '<?xml version="1.0" encoding="UTF-8"?>\n\
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">\n\
  <Link rel="remoteStorage"\n\
        api="simple"\n\
        auth="' + host + '/auth/zebcoe@locog"\n\
        template="' + host + '/data/zebcoe@locog/{category}" />\n\
</XRD>' )
  }})
}})

