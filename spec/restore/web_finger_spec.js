var RestoreSteps = require("../restore_steps")

JS.Test.describe("WebFinger", function() { with(this) {
  include(RestoreSteps)

  before(function() { this.start(4567) })
  after (function() { this.stop() })

  define("host", "http://localhost:4567")

  it("returns host metadata as XRD", function() { with(this) {
    get( "/.well-known/host-meta", {} )

    check_status( 200 )
    check_header( "Access-Control-Allow-Origin", "*" )
    check_header( "Content-Type", "application/xrd+xml" )

    check_body( '<?xml version="1.0" encoding="UTF-8"?>\n\
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">\n\
  <Link rel="lrdd"\n\
        type="application/xrd+xml"\n\
        template="' + host + '/webfinger/xrd/{uri}" />\n\
</XRD>' )
  }})

  it("returns host metadata as JSON", function() { with(this) {
    get( "/.well-known/host-meta.json", {resource: "acct:zebcoe@locog"} )

    check_status( 200 )
    check_header( "Access-Control-Allow-Origin", "*" )
    check_header( "Content-Type", "application/json" )

    check_json({
      "links": [
        {
          "href": host + "/storage/zebcoe",
          "rel":  "remoteStorage",
          "type": "https://www.w3.org/community/rww/wiki/read-write-web-00#simple",
          "properties": {
            "auth-method":    "https://tools.ietf.org/html/draft-ietf-oauth-v2-26#section-4.2",
            "auth-endpoint":  host + "/oauth/zebcoe"
          }
        }
      ]
    })
  }})

  it("returns a 404 if no resource is given", function() { with(this) {
    get( "/.well-known/host-meta.json" )

    check_status( 404 )
    check_header( "Access-Control-Allow-Origin", "*" )
    check_body( "" )
  }})

  it("returns account metadata as XRD", function() { with(this) {
    get( "/webfinger/xrd/acct:zebcoe@locog", {} )

    check_status( 200 )
    check_header( "Access-Control-Allow-Origin", "*" )
    check_header( "Content-Type", "application/xrd+xml" )

    check_body( '<?xml version="1.0" encoding="UTF-8"?>\n\
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">\n\
  <Link rel="remoteStorage"\n\
        api="simple"\n\
        auth="' + host + '/oauth/zebcoe"\n\
        template="' + host + '/storage/zebcoe/{category}" />\n\
</XRD>' )
  }})
}})

