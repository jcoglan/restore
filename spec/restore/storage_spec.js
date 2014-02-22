var RestoreSteps = require("../restore_steps"),
    JS = require("jstest")

JS.Test.describe("Storage", function() { with(this) {
  include(RestoreSteps)

  define("buffer", function(string) {
    return {
      equals: function(other) {
        return other instanceof Buffer && other.toString("utf8") === string
      }
    }
  })

  before(function() { with(this) {
    this.store = {}

    //Bearer a_token
    stub(store, "permissions").given("boris", "a_token").yields([new Error()])
    stub(store, "permissions").given("zebcoe", "a_token").yields([null, {
      "/locog/":     ["r","w"],
      "/books/":     ["r"],
      "/statuses/":  ["w"],
      "/deep/dir/":  ["r","w"]
    }])
    stub(store, "queryToken").given("zebcoe@local.dev", "a_token").yields([null, [
      "/public/locog/:rw",
      "/locog/:rw",
      "/public/books/:r",
      "/books/:r",
      "/public/statuses/:rw",
      "/statuses/:rw",
      "/public/deep/dir/:rw",
      "/deep/dir/:rw"
    ]])
    
    //Bearer root_token
    stub(store, "permissions").given("zebcoe", "root_token").yields([null, {
      "/": ["r","w"]
    }])
    stub(store, "queryToken").given("zebcoe@local.dev", "root_token").yields([null, [
      "/:rw"
    ]])
    
    //Bearer bad_token
    stub(store, "permissions").given("zebcoe", "bad_token").yields([new Error()])
    stub(store, "queryToken").given("zebcoe@local.dev", "bad_token").yields([null, undefined])

    this.modifiedTimestamp = Date.UTC(2012, 1, 25, 13, 37).toString()
  }})

  before(function() { this.start(4567) })
  after (function() { this.stop() })

  it("returns a 400 if the client uses path traversal in the path", function() { with(this) {
    get( "/storage/zebcoe@local.dev/locog/../seats" )
    check_status( 400 )
    check_header( "Access-Control-Allow-Origin", "*" )
  }})

  it("returns a 400 if the client uses invalid characters in the path", function() { with(this) {
    get( "/storage/zebcoe@local.dev/locog/$eats" )
    check_status( 400 )
    check_header( "Access-Control-Allow-Origin", "*" )
  }})

  it("returns a 400 if the client uses a zero-length path", function() { with(this) {
    get( "/storage/zebcoe" )
    check_status( 400 )
    check_header( "Access-Control-Allow-Origin", "*" )
  }})

  describe("OPTIONS", function() { with(this) {
    it("returns access control headers", function() { with(this) {
      options( "/storage/zebcoe@local.dev/locog/seats", {} )
      check_status( 200 )
      check_header( "Access-Control-Allow-Headers", "Authorization, Content-Length, Content-Type, If-Match, If-None-Match, Origin, X-Requested-With" )
      check_header( "Access-Control-Allow-Methods", "GET, PUT, DELETE" )
      check_header( "Access-Control-Allow-Origin", "*" )
      check_header( "Access-Control-Expose-Headers", "Content-Type, Content-Length, ETag" )
      check_header( "Cache-Control", "no-cache, no-store" )
      check_body( "" )
    }})
  }})

  describe("GET", function() { with(this) {
    define("item", {
      type:     new Buffer("custom/type", 'utf-8'),
      modified: new Buffer('1330177020000', 'utf-8'),
      value:    new Buffer("a value")
    })

    define("emptyDir", {
      type:     new Buffer("application/json", 'utf-8'),
      modified: new Buffer('1330177020000', 'utf-8'),
      value:    new Buffer(JSON.stringify({}), 'utf-8')
    })

    describe("when a valid access token is used", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
      }})

      it("asks the store for the item", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "content:/locog/seats").yielding([null, item.value])
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats").yielding([null, item.modified])
        expect(store, "getItem").given("zebcoe@local.dev", "contentType:/locog/seats").yielding([null, item.type])
        get( "/storage/zebcoe@local.dev/locog/seats", {} )
      }})

      it("asks the store for items containing dots", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "content:/locog/seats.gif").yielding([null, item.value])
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats.gif").yielding([null, item.modified])
        expect(store, "getItem").given("zebcoe@local.dev", "contentType:/locog/seats.gif").yielding([null, item.type])
        get( "/storage/zebcoe@local.dev/locog/seats.gif", {} )
      }})

      it("asks the store for a deep item", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "content:/deep/dir/value").yielding([null, item.value])
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/deep/dir/value").yielding([null, item.modified])
        expect(store, "getItem").given("zebcoe@local.dev", "contentType:/deep/dir/value").yielding([null, item.type])
        get( "/storage/zebcoe@local.dev/deep/dir/value", {} )
      }})

      it("passes the path literally to the store", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "content:/locog/a%2Fpath").yielding([null, item.value])
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/a%2Fpath").yielding([null, item.modified])
        expect(store, "getItem").given("zebcoe@local.dev", "contentType:/locog/a%2Fpath").yielding([null, item.type])
        get( "/storage/zebcoe@local.dev/locog/a%2Fpath", {} )
      }})

      it("asks the store for a directory listing", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "content:/locog/").yielding([null, emptyDir.value])
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/").yielding([null, emptyDir.modified])
        get( "/storage/zebcoe@local.dev/locog/", {} )
      }})

      it("asks the store for a deep directory listing", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "content:/deep/dir/").yielding([null, emptyDir.value])
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/deep/dir/").yielding([null, emptyDir.modified])
        get( "/storage/zebcoe@local.dev/deep/dir/", {} )
      }})

      it("asks the store for a root listing", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "content:/").yielding([null, emptyDir.value])
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/").yielding([null, emptyDir.modified])
        header( "Authorization", "Bearer root_token" )
        get( "/storage/zebcoe@local.dev/", {} )
      }})

      it("asks the store for an item conditionally based on If-None-Match", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "content:/locog/seats").yielding([null, new Buffer(item.value, 'utf-8')])
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats").yielding([null, new Buffer(item.modified.toString(), 'utf-8')])
        expect(store, "getItem").given("zebcoe@local.dev", "contentType:/locog/seats").yielding([null, new Buffer(item.type, 'utf-8')])
        header( "If-None-Match", '"boo"' )
        get( "/storage/zebcoe@local.dev/locog/seats", {} )
      }})

      it("does not ask the store for an item in an unauthorized directory", function() { with(this) {
        expect(store, "getItem").exactly(0)
        get( "/storage/zebcoe@local.dev/jsconf/tickets", {} )
      }})

      it("does not ask the store for an item in a too-broad directory", function() { with(this) {
        expect(store, "getItem").exactly(0)
        get( "/storage/zebcoe@local.dev/deep/nothing", {} )
      }})

      it("does not ask the store for an unauthorized directory", function() { with(this) {
        expect(store, "getItem").exactly(0)
        get( "/storage/zebcoe@local.dev/deep/", {} )
      }})

      it("does not ask the store for an item for another user", function() { with(this) {
        expect(store, "getItem").exactly(0)
        get( "/storage/boris@local.dev/locog/seats", {} )
      }})
    }})

    describe("when an invalid access token is used", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer bad_token" )
      }})
    
      it("does not ask the store for the item", function() { with(this) {
        expect(store, "getItem").exactly(0)
        get( "/storage/zebcoe@local.dev/locog/seats", {} )
      }})
      
      it("asks the store for a public item", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "content:/public/locog/seats").yielding([null, item.value])
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/public/locog/seats").yielding([null, item.modified])
        expect(store, "getItem").given("zebcoe@local.dev", "contentType:/public/locog/seats").yielding([null, item.type])
        get( "/storage/zebcoe@local.dev/public/locog/seats", {} )
      }})
      
      it("does not ask the store for a public directory", function() { with(this) {
        expect(store, "getItem").exactly(0)
        get( "/storage/zebcoe@local.dev/public/locog/seats/", {} )
      }})

      it("returns an OAuth error", function() { with(this) {
        get( "/storage/zebcoe@local.dev/locog/seats", {} )
        check_status( 401 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Cache-Control", "no-cache, no-store" )
        check_header( "WWW-Authenticate", 'Bearer realm="remoteStorage" error="invalid_token"' )
      }})
    }})
    
    describe("when the store returns an item", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
      }})
      
      it("returns the value in the response", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "content:/locog/seats").yielding([null, item.value])
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats").yielding([null, item.modified])
        expect(store, "getItem").given("zebcoe@local.dev", "contentType:/locog/seats").yielding([null, item.type])
        get( "/storage/zebcoe@local.dev/locog/seats", {} )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Cache-Control", "no-cache, no-store" )
        check_header( "Content-Length", "7" )
        check_header( "Content-Type", "custom/type" )
        check_header( "ETag", "\"1330177020000\"" )
        check_body( buffer("a value") )
      }})
      
      it("returns a 304 for a failed conditional", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats").yielding([null, new Buffer(item.modified.toString(), 'utf-8')])
        header( "If-None-Match", "\"1330177020000\"" )
        get( "/storage/zebcoe@local.dev/locog/seats", {} )
        check_status( 304 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Cache-Control", "no-cache, no-store" )
        check_header( "ETag", "\"1330177020000\"" )
        check_body( "" )
      }})
    }})
    
    describe("when the store returns a directory listing", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        var items = {
          bla: true,
          'bar/': true
        };
        var modified1 = new Buffer('1234544444', 'utf-8');
        var modified2 = new Buffer('12345888888', 'utf-8');
        expect(store, "getItem").given("zebcoe@local.dev", "content:/locog/seats/").yielding([null, new Buffer(JSON.stringify(items), 'utf-8')])
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats/").yielding([null, modified2])
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats/bla").yielding([null, modified1])
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats/bar/").yielding([null, modified2])
      }})

      it("returns the listing as JSON", function() { with(this) {
        get( "/storage/zebcoe@local.dev/locog/seats/", {} )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Cache-Control", "no-cache, no-store" )
        check_header( "ETag", "\"12345888888\"" )
        check_json( {"bar/": "12345888888", "bla": "1234544444"} )
      }})
    }})

    describe("when the store returns an empty directory listing", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        var items = {
        };
        var modified = new Buffer('12345888888', 'utf-8');
        expect(store, "getItem").given("zebcoe@local.dev", "content:/locog/seats/").yielding([null, new Buffer(JSON.stringify(items), 'utf-8')])
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats/").yielding([null, modified])
      }})

      it("returns a 200 response with an empty JSON object", function() { with(this) {
        get( "/storage/zebcoe@local.dev/locog/seats/", {} )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Cache-Control", "no-cache, no-store" )
        check_header( "ETag", "\"12345888888\"" )
        check_json( {} )
      }})
    }})

    describe("when the item does not exist", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats").yielding([null, undefined])
      }})

      it("returns an empty 404 response", function() { with(this) {
        get( "/storage/zebcoe@local.dev/locog/seats", {} )
        check_status( 404 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( buffer("404 Not Found") )
      }})
    }})

    describe("when the store returns an error", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "getItem").yields([new Error("We did something wrong")])
      }})

      it("returns a 500 response with the error message", function() { with(this) {
        get( "/storage/zebcoe@local.dev/locog/seats", {} )
        check_status( 500 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "500 Internal Server Error" )
      }})
    }})
  }})

  describe("PUT", function() { with(this) {
    describe("when a valid access token is used", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
      }})
      
      it("tells the store to save the given value", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats").yielding([null, new Buffer('123', 'utf-8')])
        
        expect(store, "getItem").given("zebcoe@local.dev", "content:/locog/").yielding([null, undefined])
        expect(store, "getItem").given("zebcoe@local.dev", "content:/").yielding([null, undefined])
        
        expect(store, "putItem").given("zebcoe@local.dev", "content:/locog/seats", buffer("a value")).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "content:/locog/", buffer(JSON.stringify({seats: true}))).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "content:/", buffer(JSON.stringify({'locog/': true}))).yielding([null])
        
        expect(store, "putItem").given("zebcoe@local.dev", "revision:/locog/seats", buffer('9e4647f796987297ce25c638aa6797954b40b730')).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "revision:/locog/", buffer('17e3a1238e9efb98de86d2f3313e6123445a6088')).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "revision:/", buffer('453ec93e4a3cd34a3a9b970cbe214f2376292b80')).yielding([null])
        
        expect(store, "putItem").given("zebcoe@local.dev", "contentType:/locog/seats", buffer('text/plain')).yielding([null])
        
        put( "/storage/zebcoe@local.dev/locog/seats", "a value" )
      }})
      
      it("tells the store to save a public value", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/public/locog/seats").yielding([null, new Buffer('123', 'utf-8')])
        
        expect(store, "getItem").given("zebcoe@local.dev", "content:/public/locog/").yielding([null, undefined])
        expect(store, "getItem").given("zebcoe@local.dev", "content:/public/").yielding([null, undefined])
        expect(store, "getItem").given("zebcoe@local.dev", "content:/").yielding([null, undefined])
        
        expect(store, "putItem").given("zebcoe@local.dev", "content:/public/locog/seats", buffer("a value")).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "content:/public/locog/", buffer(JSON.stringify({seats: true}))).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "content:/public/", buffer(JSON.stringify({'locog/': true}))).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "content:/", buffer(JSON.stringify({'public/': true}))).yielding([null])
        
        expect(store, "putItem").given("zebcoe@local.dev", "revision:/public/locog/seats", buffer('9e4647f796987297ce25c638aa6797954b40b730')).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "revision:/public/locog/", buffer('17e3a1238e9efb98de86d2f3313e6123445a6088')).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "revision:/public/", buffer('453ec93e4a3cd34a3a9b970cbe214f2376292b80')).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "revision:/", buffer('7a5669083f58caaa0fda960d1d1c3b500e9d410c')).yielding([null])
        
        expect(store, "putItem").given("zebcoe@local.dev", "contentType:/public/locog/seats", buffer('text/plain')).yielding([null])
        
        put( "/storage/zebcoe@local.dev/public/locog/seats", "a value" )
      }})
      
      it("tells the store to save a value conditionally based on If-None-Match", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats").yielding([null, new Buffer('123', 'utf-8')])
        
        expect(store, "getItem").given("zebcoe@local.dev", "content:/locog/").yielding([null, undefined])
        expect(store, "getItem").given("zebcoe@local.dev", "content:/").yielding([null, undefined])
        
        expect(store, "putItem").given("zebcoe@local.dev", "content:/locog/seats", buffer("a value")).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "content:/locog/", buffer(JSON.stringify({seats: true}))).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "content:/", buffer(JSON.stringify({'locog/': true}))).yielding([null])
        
        expect(store, "putItem").given("zebcoe@local.dev", "revision:/locog/seats", buffer('9e4647f796987297ce25c638aa6797954b40b730')).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "revision:/locog/", buffer('17e3a1238e9efb98de86d2f3313e6123445a6088')).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "revision:/", buffer('453ec93e4a3cd34a3a9b970cbe214f2376292b80')).yielding([null])
        
        expect(store, "putItem").given("zebcoe@local.dev", "contentType:/locog/seats", buffer('text/plain')).yielding([null])
        
        header( "If-None-Match", '"' + modifiedTimestamp + '"' )
        put( "/storage/zebcoe@local.dev/locog/seats", "a value" )
      }})

      it("tells the store to save a value conditionally based on If-Match", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats").yielding([null, new Buffer(modifiedTimestamp, 'utf-8')])
        
        expect(store, "getItem").given("zebcoe@local.dev", "content:/locog/").yielding([null, undefined])
        expect(store, "getItem").given("zebcoe@local.dev", "content:/").yielding([null, undefined])
        
        expect(store, "putItem").given("zebcoe@local.dev", "content:/locog/seats", buffer("a value")).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "content:/locog/", buffer(JSON.stringify({seats: true}))).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "content:/", buffer(JSON.stringify({'locog/': true}))).yielding([null])
        
        expect(store, "putItem").given("zebcoe@local.dev", "revision:/locog/seats", buffer('9e4647f796987297ce25c638aa6797954b40b730')).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "revision:/locog/", buffer('17e3a1238e9efb98de86d2f3313e6123445a6088')).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "revision:/", buffer('453ec93e4a3cd34a3a9b970cbe214f2376292b80')).yielding([null])
        
        expect(store, "putItem").given("zebcoe@local.dev", "contentType:/locog/seats", buffer('text/plain')).yielding([null])
        
        header( "If-Match", '"' + modifiedTimestamp + '"' )
        put( "/storage/zebcoe@local.dev/locog/seats", "a value" )
      }})
      
      it("does not tell the store to save a directory", function() { with(this) {
        expect(store, "putItem").exactly(0)
        put( "/storage/zebcoe@local.dev/locog/seats/", "a value" )
      }})

      it("does not tell the store to save to a write-unauthorized directory", function() { with(this) {
        expect(store, "putItem").exactly(0)
        put( "/storage/zebcoe@local.dev/books/house_of_leaves", "a value" )
      }})
    }})

    describe("when an invalid access token is used", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer bad_token" )
      }})

      it("does not tell the store to save the given value", function() { with(this) {
        expect(store, "putItem").exactly(0)
        put( "/storage/zebcoe@local.dev/locog/seats", "a value" )
      }})
    }})

    describe("when the store says the item was created", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "putItem").yields([null, true, 1347016875231])
      }})

      it("returns an empty 200 response", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats").yielding([null, buffer(modifiedTimestamp)])
        
        expect(store, "getItem").given("zebcoe@local.dev", "content:/locog/").yielding([null, undefined])
        expect(store, "getItem").given("zebcoe@local.dev", "content:/").yielding([null, undefined])
        
        expect(store, "putItem").given("zebcoe@local.dev", "content:/locog/seats", buffer("a value")).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "content:/locog/", buffer(JSON.stringify({seats: true}))).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "content:/", buffer(JSON.stringify({'locog/': true}))).yielding([null])
        
        expect(store, "putItem").given("zebcoe@local.dev", "revision:/locog/seats", buffer('9e4647f796987297ce25c638aa6797954b40b730')).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "revision:/locog/", buffer('17e3a1238e9efb98de86d2f3313e6123445a6088')).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "revision:/", buffer('453ec93e4a3cd34a3a9b970cbe214f2376292b80')).yielding([null])
        
        expect(store, "putItem").given("zebcoe@local.dev", "contentType:/locog/seats", buffer('text/plain')).yielding([null])
        
        put( "/storage/zebcoe@local.dev/locog/seats", "a value" )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "ETag", "\"9e4647f796987297ce25c638aa6797954b40b730\"" )
        check_body( "" )
      }})
    }})

    describe("when the store says there was a version conflict creating", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "putItem").yields([null])
      }})

      it("returns an empty 412 response", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats").yielding([null, new Buffer(modifiedTimestamp, 'utf-8')])
        
        header ( 'If-None-Match', '*' )
        put( "/storage/zebcoe@local.dev/locog/seats", "a value" )
        check_status( 412 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "ETag", "\"" + modifiedTimestamp + "\"" )
        check_body( "412 Precondition failed" )
      }})
    }})

    describe("when the store says there was a version conflict updating", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "putItem").yields([null])
      }})

      it("returns an empty 412 response", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats").yielding([null, new Buffer(modifiedTimestamp, 'utf-8')])
        
        header ( 'If-Match', '"abc"' )
        put( "/storage/zebcoe@local.dev/locog/seats", "a value" )
        check_status( 412 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "ETag", "\"" + modifiedTimestamp + "\"" )
        check_body( "412 Precondition failed" )
      }})
    }})

    describe("when the store returns an error", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "putItem").yields([new Error("Something is technically wrong")])
      }})

      it("returns a 500 response with the error message", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats").yielding([null, buffer(modifiedTimestamp)])
        
        put( "/storage/zebcoe@local.dev/locog/seats", "a value" )
        check_status( 500 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "500 Internal Server Error" )
      }})
    }})
  }})

  describe("DELETE", function() { with(this) {
    before(function() { with(this) {
      header( "Authorization", "Bearer a_token" )
      expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats").yielding([null, buffer(modifiedTimestamp) ])
    }})
    
    describe("when deletion is successful", function() { with(this) {
      before(function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "content:/locog/").yielding([null, new Buffer(JSON.stringify({ seats: true }), 'utf-8') ])
        
        expect(store, "deleteItem").given("zebcoe@local.dev", "content:/locog/seats").yielding([null])
        expect(store, "deleteItem").given("zebcoe@local.dev", "revision:/locog/seats").yielding([null])
        expect(store, "deleteItem").given("zebcoe@local.dev", "contentType:/locog/seats").yielding([null])
        
        expect(store, "putItem").given("zebcoe@local.dev", "content:/locog/", buffer(JSON.stringify({}))).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "revision:/locog/", buffer('bf21a9e8fbc5a3846fb05b4fa0859e0917b2202f')).yielding([null])
        
        expect(store, "putItem").given("zebcoe@local.dev", "content:/", buffer(JSON.stringify({}))).yielding([null])
        expect(store, "putItem").given("zebcoe@local.dev", "revision:/", buffer('bf21a9e8fbc5a3846fb05b4fa0859e0917b2202f')).yielding([null])
      }})

      it("tells the store to delete the given item", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "content:/").yielding([null, new Buffer(JSON.stringify({ 'locog/': true }), 'utf-8') ])
        this.delete( "/storage/zebcoe@local.dev/locog/seats", {} )
      }})
      
      it("tells the store to delete an item conditionally based on If-None-Match", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "content:/").yielding([null, new Buffer(JSON.stringify({ 'locog/': true }), 'utf-8') ])
        header( "If-None-Match", '"abc"' )
        this.delete( "/storage/zebcoe@local.dev/locog/seats", {} )
      }})

      it("tells the store to delete an item conditionally based on If-Match", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "content:/").yielding([null, new Buffer(JSON.stringify({ 'locog/': true }), 'utf-8') ])
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats").yielding([null, new Buffer('1330177020000', 'utf-8') ])
        header( "If-Match", '"' + modifiedTimestamp.toString() + '"' )
        this.delete( "/storage/zebcoe@local.dev/locog/seats", {} )
      }})
      
      it("returns an empty 200 response", function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "content:/").yielding([null, new Buffer(JSON.stringify({ 'locog/': true }), 'utf-8') ])
        this.delete( "/storage/zebcoe@local.dev/locog/seats", {} )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "" )
      }})
    }})

    describe("when the store says the item does not exist", function() { with(this) {
      before(function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats").yielding([null, undefined ])
      }})

      it("returns an empty 404 response", function() { with(this) {
        this.delete( "/storage/zebcoe@local.dev/locog/seats", {} )
        check_status( 404 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "404 Not Found" )
      }})
    }})

    describe("when the store says there was a version conflict If-Match", function() { with(this) {
      before(function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats").yielding([null, buffer(modifiedTimestamp) ])
        stub(store, "deleteItem").yields([null, false, 1358121717830, true])
      }})

      it("returns an empty 412 response", function() { with(this) {
        header( "If-Match", '"abc"' )
        this.delete( "/storage/zebcoe@local.dev/locog/seats", {} )
        check_status( 412 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "412 Precondition failed" )
      }})
    }})
    
    describe("when the store says there was a version conflict If-None-Match", function() { with(this) {
      before(function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats").yielding([null, new Buffer(modifiedTimestamp, 'utf-8') ])
      }})

      it("returns an empty 412 response", function() { with(this) {
        header( "If-None-Match", '"' + modifiedTimestamp + '"' )
        this.delete( "/storage/zebcoe@local.dev/locog/seats", {} )
        check_status( 412 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "412 Precondition failed" )
      }})
    }})

    describe("when the store returns an error", function() { with(this) {
      before(function() { with(this) {
        expect(store, "getItem").given("zebcoe@local.dev", "revision:/locog/seats").yielding([null, new Buffer(modifiedTimestamp, 'utf-8') ])
        stub(store, "deleteItem").yields([new Error("OH NOES!")])
      }})

      it("returns a 500 response with the error message", function() { with(this) {
        this.delete( "/storage/zebcoe@local.dev/locog/seats", {} )
        check_status( 500 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "500 Internal Server Error" )
      }})
    }})
  }})
}})
