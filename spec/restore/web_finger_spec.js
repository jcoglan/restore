var RestoreSteps = require("../restore_steps"),
    JS = require("jstest")

JS.Test.describe("WebFinger", function() { with(this) {
  include(RestoreSteps)

  before(function() { this.start(4567) })
  after (function() { this.stop() })

  define("host", "http://localhost:4567")

  it("default returns host metadata as JSON", function() { with(this) {
    get( "/.well-known/webfinger", {} )

    check_status( 200 )
    check_header( "Access-Control-Allow-Origin", "*" )
    check_header( "Content-Type", "application/jrd+json" )

    check_json({
      "links": [
        {
          "rel": "lrdd",
          "template": host + "/webfinger/jrd?resource={uri}"
        }
      ]
    })
  }})

  it("returns host metadata as JSON", function() { with(this) {
    get( "/.well-known/webfinger.json", {} )

    check_status( 200 )
    check_header( "Access-Control-Allow-Origin", "*" )
    check_header( "Content-Type", "application/jrd+json" )

    check_json({
      "links": [
        {
          "rel": "lrdd",
          "template": host + "/webfinger/jrd?resource={uri}"
        }
      ]
    })
  }})

  it("returns host metadata as XML", function() { with(this) {
    get( "/.well-known/webfinger.xml", {} )

    check_status( 200 )
    check_header( "Access-Control-Allow-Origin", "*" )
    check_header( "Content-Type", "application/xrd+xml" )

    check_body( '<?xml version="1.0" encoding="UTF-8"?>\n\
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">\n\
  <Link rel="lrdd"\n\
        type="application/xrd+xml"\n\
        template="' + host + '/webfinger/xrd?resource={uri}" />\n\
</XRD>' )
  }})

 it("returns account metadata as JSON", function() { with(this) {
    get( "/webfinger/jrd", {resource: "acct:zebcoe@locog"} )

    check_status( 200 )
    check_header( "Access-Control-Allow-Origin", "*" )
    check_header( "Content-Type", "application/jrd+json" )

    check_json({
      "links": [
        {
          "rel": "remoteStorage",
          "api": "simple",
          "auth": host + "/oauth/zebcoe",
          "template": host + "/storage/zebcoe/{category}"
        }
      ]
    })
  }})

  it("returns account metadata as XML", function() { with(this) {
    get( "/webfinger/xrd", {resource: "acct:zebcoe@locog"} )

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

  it("returns resource metadata as JSON", function() { with(this) {
    get( "/.well-known/webfinger.json", {resource: "acct:zebcoe@locog"} )

    check_status( 200 )
    check_header( "Access-Control-Allow-Origin", "*" )
    check_header( "Content-Type", "application/jrd+json" )

    check_json({
      "links": [
        {
          "href": host + "/storage/zebcoe",
          "rel":  "remotestorage",
          "type": "draft-dejong-remotestorage-01",
          "properties": {
            "auth-method":    "http://tools.ietf.org/html/rfc6749#section-4.2",
            "auth-endpoint":  host + "/oauth/zebcoe",
            "http://tools.ietf.org/html/rfc6749#section-4.2": host + "/oauth/zebcoe",
            "http://remotestorage.io/spec/version": "draft-dejong-remotestorage-01"
          }
        }
      ]
    })
  }})

  it("returns resource metadata as XML", function() { with(this) {
    get( "/.well-known/webfinger.xml", {resource: "acct:zebcoe@locog"} )

    check_status( 200 )
    check_header( "Access-Control-Allow-Origin", "*" )
    check_header( "Content-Type", "application/xrd+xml" )

    check_body( '<?xml version="1.0" encoding="UTF-8"?>\n\
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">\n\
  <Link href="http://localhost:4567/storage/zebcoe"\n\
        rel="remotestorage"\n\
        type="draft-dejong-remotestorage-01">\n\
    <Property type="auth-method">http://tools.ietf.org/html/rfc6749#section-4.2</Property>\n\
    <Property type="auth-endpoint">http://localhost:4567/oauth/zebcoe</Property>\n\
    <Property type="http://remotestorage.io/spec/version">draft-dejong-remotestorage-01</Property>\n\
    <Property type="http://tools.ietf.org/html/rfc6749#section-4.2">http://localhost:4567/oauth/zebcoe</Property>\n\
  </Link>\n\
</XRD>' )
  }})
}})
