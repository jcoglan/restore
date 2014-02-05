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
    stub(store, "queryToken").given("a_token").yields([null, [
      "zebcoe@local.dev/locog/:rw",
      "zebcoe@local.dev/books/:r",
      "zebcoe@local.dev/statuses/:rw",
      "zebcoe@local.dev/deep/dir/:rw"
    ]])
    
    //Bearer root_token
    stub(store, "permissions").given("zebcoe", "root_token").yields([null, {
      "/": ["r","w"]
    }])
    stub(store, "queryToken").given("root_token").yields([null, [
      "zebcoe@local.dev/:rw"
    ]])
    
    //Bearer bad_token
    stub(store, "permissions").given("zebcoe", "bad_token").yields([new Error()])
    stub(store, "queryToken").given("bad_token").yields([null, undefined])

    this.modifiedTimestamp = Date.UTC(2012, 1, 25, 13, 37)
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
      type:     "custom/type",
      modified: 1330177020000,
      value:    new Buffer("a value")
    })

    define("emptyDir", {
      type:     "application/json",
      modified: 1330177020000,
      value:    {}
    })

    describe("when a valid access token is used", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
      }})

      it("asks the store for the item", function() { with(this) {
        expect(store, "get").given("content:zebcoe@local.dev/locog/seats").yielding([null, item.value])
        expect(store, "get").given("revision:zebcoe@local.dev/locog/seats").yielding([null, item.modified])
        expect(store, "get").given("contentType:zebcoe@local.dev/locog/seats").yielding([null, item.type])
        get( "/storage/zebcoe@local.dev/locog/seats", {} )
      }})

      it("asks the store for items containing dots", function() { with(this) {
        expect(store, "get").given("content:zebcoe@local.dev/locog/seats.gif").yielding([null, item.value])
        expect(store, "get").given("revision:zebcoe@local.dev/locog/seats.gif").yielding([null, item.modified])
        expect(store, "get").given("contentType:zebcoe@local.dev/locog/seats.gif").yielding([null, item.type])
        get( "/storage/zebcoe@local.dev/locog/seats.gif", {} )
      }})

      it("asks the store for a deep item", function() { with(this) {
        expect(store, "get").given("content:zebcoe@local.dev/deep/dir/value").yielding([null, item.value])
        expect(store, "get").given("revision:zebcoe@local.dev/deep/dir/value").yielding([null, item.modified])
        expect(store, "get").given("contentType:zebcoe@local.dev/deep/dir/value").yielding([null, item.type])
        get( "/storage/zebcoe@local.dev/deep/dir/value", {} )
      }})

      it("passes the path literally to the store", function() { with(this) {
        expect(store, "get").given("content:zebcoe@local.dev/locog/a%2Fpath").yielding([null, item.value])
        expect(store, "get").given("revision:zebcoe@local.dev/locog/a%2Fpath").yielding([null, item.modified])
        expect(store, "get").given("contentType:zebcoe@local.dev/locog/a%2Fpath").yielding([null, item.type])
        get( "/storage/zebcoe@local.dev/locog/a%2Fpath", {} )
      }})

      it("asks the store for a directory listing", function() { with(this) {
        expect(store, "get").given("content:zebcoe@local.dev/locog/").yielding([null, emptyDir.value])
        expect(store, "get").given("revision:zebcoe@local.dev/locog/").yielding([null, emptyDir.modified])
        get( "/storage/zebcoe@local.dev/locog/", {} )
      }})

      it("asks the store for a deep directory listing", function() { with(this) {
        expect(store, "get").given("content:zebcoe@local.dev/deep/dir/").yielding([null, emptyDir.value])
        expect(store, "get").given("revision:zebcoe@local.dev/deep/dir/").yielding([null, emptyDir.modified])
        get( "/storage/zebcoe@local.dev/deep/dir/", {} )
      }})

      it("asks the store for a root listing", function() { with(this) {
        expect(store, "get").given("content:zebcoe@local.dev/").yielding([null, emptyDir.value])
        expect(store, "get").given("revision:zebcoe@local.dev/").yielding([null, emptyDir.modified])
        header( "Authorization", "Bearer root_token" )
        get( "/storage/zebcoe@local.dev/", {} )
      }})

      it("asks the store for an item conditionally based on If-None-Match", function() { with(this) {
        expect(store, "get").given("content:zebcoe@local.dev/locog/seats").yielding([null, item.value])
        expect(store, "get").given("revision:zebcoe@local.dev/locog/seats").yielding([null, item.modified])
        expect(store, "get").given("contentType:zebcoe@local.dev/locog/seats").yielding([null, item.type])
        header( "If-None-Match", modifiedTimestamp )
        get( "/storage/zebcoe@local.dev/locog/seats", {} )
      }})

      it("does not ask the store for an item in an unauthorized directory", function() { with(this) {
        expect(store, "get").exactly(0)
        get( "/storage/zebcoe@local.dev/jsconf/tickets", {} )
      }})

      it("does not ask the store for an item in a too-broad directory", function() { with(this) {
        expect(store, "get").exactly(0)
        get( "/storage/zebcoe@local.dev/deep/nothing", {} )
      }})

      it("does not ask the store for an unauthorized directory", function() { with(this) {
        expect(store, "get").exactly(0)
        get( "/storage/zebcoe@local.dev/deep/", {} )
      }})

      it("does not ask the store for an item for another user", function() { with(this) {
        expect(store, "get").exactly(0)
        get( "/storage/boris@local.dev/locog/seats", {} )
      }})
    }})

    describe("when an invalid access token is used", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer bad_token" )
      }})

      it("does not ask the store for the item", function() { with(this) {
        expect(store, "get").exactly(0)
        get( "/storage/zebcoe@local.dev/locog/seats", {} )
      }})

      it("asks the store for a public item", function() { with(this) {
        expect(store, "get").given("content:zebcoe@local.dev/public/locog/seats").yielding([null, item.value])
        expect(store, "get").given("revision:zebcoe@local.dev/public/locog/seats").yielding([null, item.modified])
        expect(store, "get").given("contentType:zebcoe@local.dev/public/locog/seats").yielding([null, item.type])
        get( "/storage/zebcoe@local.dev/public/locog/seats", {} )
      }})

      it("does not ask the store for a public directory", function() { with(this) {
        expect(store, "get").exactly(0)
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
        expect(store, "get").given("content:zebcoe@local.dev/locog/seats").yielding([null, item.value])
        expect(store, "get").given("revision:zebcoe@local.dev/locog/seats").yielding([null, item.modified.toString()])
        expect(store, "get").given("contentType:zebcoe@local.dev/locog/seats").yielding([null, item.type])
        get( "/storage/zebcoe@local.dev/locog/seats", {} )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Cache-Control", "no-cache, no-store" )
        check_header( "Content-Length", "7" )
        check_header( "Content-Type", "custom/type" )
        check_header( "ETag", "\"1330177020000\"" )
        check_body( buffer("a value") )
      }})

      it("returns a 412 for a failed conditional", function() { with(this) {
        expect(store, "get").given("content:zebcoe@local.dev/locog/seats").yielding([null, item.value])
        expect(store, "get").given("revision:zebcoe@local.dev/locog/seats").yielding([null, item.modified.toString()])
        expect(store, "get").given("contentType:zebcoe@local.dev/locog/seats").yielding([null, item.type])
        //TODO: header( "If-None-Match", "\"1330177020000\"" )
        get( "/storage/zebcoe@local.dev/locog/seats", {} )
        //TODO: check_status( 304 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Cache-Control", "no-cache, no-store" )
        check_header( "ETag", "\"1330177020000\"" )
        //TODO: check_body( "" )
      }})
    }})

/*
    describe("when the store returns a directory listing", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "get").yields([null, { children: [{name: "bla", modified: 1234544444}, {name: "bar/", modified: 12345888888}], modified: 12345888888 }])
      }})

      it("returns the listing as JSON", function() { with(this) {
        get( "/storage/zebcoe@local.dev/locog/seats/", {} )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Cache-Control", "no-cache, no-store" )
        check_header( "ETag", "12345888888" )
        check_json( {"bar/": "12345888888", "bla": "1234544444"} )
      }})
    }})

    describe("when the store returns an empty directory listing", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "get").yields([null, { children: [], modified: 12345888888 }])
      }})

      it("returns a 200 response with an empty JSON object", function() { with(this) {
        get( "/storage/zebcoe@local.dev/locog/seats/", {} )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Cache-Control", "no-cache, no-store" )
        check_header( "ETag", "12345888888" )
        check_json( {} )
      }})
    }})

    describe("when the item does not exist", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "get").yields([null, undefined])
      }})

      it("returns an empty 404 response", function() { with(this) {
        get( "/storage/zebcoe@local.dev/locog/seats", {} )
        check_status( 404 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "" )
      }})
    }})

    describe("when the store returns an error", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "get").yields([new Error("We did something wrong")])
      }})

      it("returns a 500 response with the error message", function() { with(this) {
        get( "/storage/zebcoe@local.dev/locog/seats", {} )
        check_status( 500 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "We did something wrong" )
      }})
    }})
  }})

  describe("PUT", function() { with(this) {
    describe("when a valid access token is used", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
      }})

      it("tells the store to save the given value", function() { with(this) {
        expect(store, "put").given("zebcoe", "/locog/seats", "text/plain", buffer("a value"), null).yielding([null])
        put( "/storage/zebcoe@local.dev/locog/seats", "a value" )
      }})

      it("tells the store to save a public value", function() { with(this) {
        expect(store, "put").given("zebcoe", "/public/locog/seats", "text/plain", buffer("a value"), null).yielding([null])
        put( "/storage/zebcoe@local.dev/public/locog/seats", "a value" )
      }})

      it("tells the store to save a value conditionally based on If-None-Match", function() { with(this) {
        expect(store, "put").given("zebcoe", "/locog/seats", "text/plain", buffer("a value"), modifiedTimestamp).yielding([null])
        header( "If-None-Match", modifiedTimestamp )
        put( "/storage/zebcoe@local.dev/locog/seats", "a value" )
      }})

      it("tells the store to save a value conditionally based on If-Match", function() { with(this) {
        expect(store, "put").given("zebcoe", "/locog/seats", "text/plain", buffer("a value"), modifiedTimestamp).yielding([null])
        header( "If-Match", modifiedTimestamp )
        put( "/storage/zebcoe@local.dev/locog/seats", "a value" )
      }})

      it("does not tell the store to save a directory", function() { with(this) {
        expect(store, "put").exactly(0)
        put( "/storage/zebcoe@local.dev/locog/seats/", "a value" )
      }})

      it("does not tell the store to save to a write-unauthorized directory", function() { with(this) {
        expect(store, "put").exactly(0)
        put( "/storage/zebcoe@local.dev/books/house_of_leaves", "a value" )
      }})
    }})

    describe("when an invalid access token is used", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer bad_token" )
      }})

      it("does not tell the store to save the given value", function() { with(this) {
        expect(store, "put").exactly(0)
        put( "/storage/zebcoe@local.dev/locog/seats", "a value" )
      }})
    }})

    describe("when the store says the item was created", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "put").yields([null, true, 1347016875231])
      }})

      it("returns an empty 201 response", function() { with(this) {
        put( "/storage/zebcoe@local.dev/locog/seats", "a value" )
        check_status( 201 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "ETag", "1347016875231" )
        check_body( "" )
      }})
    }})

    describe("when the store says the item was not created but updated", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "put").yields([null, false, 1347016875231])
      }})

      it("returns an empty 200 response", function() { with(this) {
        put( "/storage/zebcoe@local.dev/locog/seats", "a value" )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "ETag", "1347016875231" )
        check_body( "" )
      }})
    }})

    describe("when the store says there was a version conflict", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "put").yields([null, false, 1347016875231, true])
      }})

      it("returns an empty 412 response", function() { with(this) {
        put( "/storage/zebcoe@local.dev/locog/seats", "a value" )
        check_status( 412 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "ETag", "1347016875231" )
        check_body( "" )
      }})
    }})

    describe("when the store returns an error", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "put").yields([new Error("Something is technically wrong")])
      }})

      it("returns a 500 response with the error message", function() { with(this) {
        put( "/storage/zebcoe@local.dev/locog/seats", "a value" )
        check_status( 500 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "Something is technically wrong" )
      }})
    }})
  }})

  describe("DELETE", function() { with(this) {
    before(function() { with(this) {
      header( "Authorization", "Bearer a_token" )
    }})

    it("tells the store to delete the given item", function() { with(this) {
      expect(store, "delete").given("zebcoe", "/locog/seats", null).yielding([null])
      this.delete( "/storage/zebcoe@local.dev/locog/seats", {} )
    }})

    it("tells the store to delete an item conditionally based on If-None-Match", function() { with(this) {
      expect(store, "delete").given("zebcoe", "/locog/seats", modifiedTimestamp).yielding([null])
      header( "If-None-Match", modifiedTimestamp )
      this.delete( "/storage/zebcoe@local.dev/locog/seats", {} )
    }})

    it("tells the store to delete an item conditionally based on If-Match", function() { with(this) {
      expect(store, "delete").given("zebcoe", "/locog/seats", modifiedTimestamp).yielding([null])
      header( "If-Match", modifiedTimestamp )
      this.delete( "/storage/zebcoe@local.dev/locog/seats", {} )
    }})

    describe("when the store says the item was deleted", function() { with(this) {
      before(function() { with(this) {
        stub(store, "delete").yields([null, true, 1358121717830])
      }})

      it("returns an empty 200 response", function() { with(this) {
        this.delete( "/storage/zebcoe@local.dev/locog/seats", {} )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "ETag", "1358121717830" )
        check_body( "" )
      }})
    }})

    describe("when the store says the item was not deleted", function() { with(this) {
      before(function() { with(this) {
        stub(store, "delete").yields([null, false, 1358121717830])
      }})

      it("returns an empty 404 response", function() { with(this) {
        this.delete( "/storage/zebcoe@local.dev/locog/seats", {} )
        check_status( 404 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "" )
      }})
    }})

    describe("when the store says there was a version conflict", function() { with(this) {
      before(function() { with(this) {
        stub(store, "delete").yields([null, false, 1358121717830, true])
      }})

      it("returns an empty 412 response", function() { with(this) {
        this.delete( "/storage/zebcoe@local.dev/locog/seats", {} )
        check_status( 412 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "" )
      }})
    }})

    describe("when the store returns an error", function() { with(this) {
      before(function() { with(this) {
        stub(store, "delete").yields([new Error("OH NOES!")])
      }})

      it("returns a 500 response with the error message", function() { with(this) {
        this.delete( "/storage/zebcoe@local.dev/locog/seats", {} )
        check_status( 500 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "OH NOES!" )
      }})
    }})
  */
  }})
}})

