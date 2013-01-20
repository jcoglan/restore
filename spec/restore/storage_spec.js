var RestoreSteps = require("../restore_steps")

JS.Test.describe("Storage", function() { with(this) {
  include(RestoreSteps)

  define("buffer", function(string) {
    return {
      equals: function(other) {
        return other instanceof Buffer && other.toString("utf8") === string
      }
    }
  })

  before(function() { this.start(4567) })
  after (function() { this.stop() })

  before(function() { with(this) {
    this.store = {}
    stub(store, "permissions").given("boris", "a_token").yields([new Error()])

    stub(store, "permissions").given("zebcoe", "a_token").yields([null, {
      "/locog/":     ["r","w"],
      "/books/":     ["r"],
      "/statuses/":  ["w"],
      "/deep/dir/":  ["r","w"]
    }])
    stub(store, "permissions").given("zebcoe", "root_token").yields([null, {
      "/": ["r","w"]
    }])
    stub(store, "permissions").given("zebcoe", "bad_token").yields([new Error()])
  }})

  it("returns a 400 if the client uses invalid characters in the path", function() { with(this) {
    get( "/storage/zebcoe/locog/./seats" )
    check_status( 400 )
    check_header( "Access-Control-Allow-Origin", "*" )
  }})

  describe("OPTIONS", function() { with(this) {
    it("returns access control headers", function() { with(this) {
      options( "/storage/zebcoe/locog/seats", {} )
      check_status( 200 )
      check_header( "Access-Control-Allow-Origin", "*" )
      check_header( "Access-Control-Allow-Methods", "GET, PUT, DELETE" )
      check_header( "Access-Control-Allow-Headers", "Authorization, Content-Length, Content-Type, Origin, X-Requested-With" )
      check_header( "Cache-Control", "no-cache, no-store" )
      check_body( "" )
    }})
  }})

  describe("GET", function() { with(this) {
    define("item", {
      type:     "custom/type",
      modified: new Date(2012, 1, 25, 13, 37),
      value:    new Buffer("a value")
    })

    describe("when a valid access token is used", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
      }})

      it("asks the store for the item", function() { with(this) {
        expect(store, "get").given("zebcoe", "/locog/seats", null).yielding([null, item])
        get( "/storage/zebcoe@local.dev/locog/seats", {} )
      }})

      it("asks the store for a deep item", function() { with(this) {
        expect(store, "get").given("zebcoe", "/deep/dir/value", null).yielding([null, item])
        get( "/storage/zebcoe@local.dev/deep/dir/value", {} )
      }})

      it("passes the path literally to the store", function() { with(this) {
        expect(store, "get").given("zebcoe", "/locog/a%2Fpath", null).yielding([null, item])
        get( "/storage/zebcoe/locog/a%2Fpath", {} )
      }})

      it("asks the store for a directory listing", function() { with(this) {
        expect(store, "get").given("zebcoe", "/locog/", null).yielding([null, item])
        get( "/storage/zebcoe/locog/", {} )
      }})

      it("asks the store for a deep directory listing", function() { with(this) {
        expect(store, "get").given("zebcoe", "/deep/dir/", null).yielding([null, item])
        get( "/storage/zebcoe/deep/dir/", {} )
      }})

      it("asks the store for a root listing", function() { with(this) {
        expect(store, "get").given("zebcoe", "/", null).yielding([null, item])
        header( "Authorization", "Bearer root_token" )
        get( "/storage/zebcoe/", {} )
      }})

      it("asks the store for an item conditionally based on If-Modifed-Since", function() { with(this) {
        var date = new Date("Sat, 25 Feb 2012 13:37:00 GMT")
        expect(store, "get").given("zebcoe", "/locog/seats", date).yielding([null, item])
        header( "If-Modified-Since", date.toGMTString() )
        get( "/storage/zebcoe/locog/seats", {} )
      }})

      it("asks the store for an item conditionally based on If-None-Match", function() { with(this) {
        var date = new Date("Sat, 25 Feb 2012 13:37:00 GMT")
        expect(store, "get").given("zebcoe", "/locog/seats", date).yielding([null, item])
        header( "If-None-Match", date.getTime().toString() )
        get( "/storage/zebcoe/locog/seats", {} )
      }})

      it("does not ask the store for an item in an unauthorized directory", function() { with(this) {
        expect(store, "get").exactly(0)
        get( "/storage/zebcoe/jsconf/tickets", {} )
      }})

      it("does not ask the store for an item in a too-broad directory", function() { with(this) {
        expect(store, "get").exactly(0)
        get( "/storage/zebcoe/deep/nothing", {} )
      }})

      it("does not ask the store for an unauthorized directory", function() { with(this) {
        expect(store, "get").exactly(0)
        get( "/storage/zebcoe/deep/", {} )
      }})

      it("does not ask the store for an item in a read-unauthorized directory", function() { with(this) {
        expect(store, "get").exactly(0)
        get( "/storage/zebcoe/statuses/first", {} )
      }})

      it("does not ask the store for an item for another user", function() { with(this) {
        expect(store, "get").exactly(0)
        get( "/storage/boris/locog/seats", {} )
      }})
    }})

    describe("when an invalid access token is used", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer bad_token" )
      }})

      it("does not ask the store for the item", function() { with(this) {
        expect(store, "get").exactly(0)
        get( "/storage/zebcoe/locog/seats", {} )
      }})

      it("asks the store for a public item", function() { with(this) {
        expect(store, "get").given("zebcoe", "/public/locog/seats", null).yielding([null, item])
        get( "/storage/zebcoe/public/locog/seats", {} )
      }})

      it("does not ask the store for a public directory", function() { with(this) {
        expect(store, "get").exactly(0)
        get( "/storage/zebcoe/public/locog/seats/", {} )
      }})

      it("returns an OAuth error", function() { with(this) {
        get( "/storage/zebcoe/locog/seats", {} )
        check_status( 401 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Cache-Control", "no-cache, no-store" )
        check_header( "WWW-Authenticate", 'Bearer realm="localhost:4567" error="invalid_token"' )
      }})
    }})

    describe("when the store returns an item", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
      }})

      it("returns the value in the response", function() { with(this) {
        stub(store, "get").yields([null, item])
        get( "/storage/zebcoe/locog/seats", {} )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Cache-Control", "no-cache, no-store" )
        check_header( "Content-Length", "7" )
        check_header( "Content-Type", "custom/type" )
        check_header( "ETag", "1330177020000" )
        check_header( "Last-Modified", "Sat, 25 Feb 2012 13:37:00 GMT" )
        check_body( buffer("a value") )
      }})

      it("returns a 304 for a failed conditional", function() { with(this) {
        stub(store, "get").yields([null, item, true])
        get( "/storage/zebcoe/locog/seats", {} )
        check_status( 304 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Cache-Control", "no-cache, no-store" )
        check_header( "ETag", "1330177020000" )
        check_header( "Last-Modified", "Sat, 25 Feb 2012 13:37:00 GMT" )
        check_body( "" )
      }})
    }})

    describe("when the store returns a directory listing", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "get").yields([null, [{name: "bla", modified: new Date(1234544444)}, {name: "bar/", modified: new Date(12345888888)}]])
      }})

      it("returns the listing as JSON", function() { with(this) {
        get( "/storage/zebcoe/locog/seats/", {} )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Cache-Control", "no-cache, no-store" )
        check_json( {"bar/": 12345888888, "bla": 1234544444} )
      }})
    }})

    describe("when the store returns an empty directory listing", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "get").yields([null, []])
      }})

      it("returns a 200 response with an empty JSON object", function() { with(this) {
        get( "/storage/zebcoe/locog/seats/", {} )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Cache-Control", "no-cache, no-store" )
        check_json( {} )
      }})
    }})

    describe("when the item does not exist", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "get").yields([null, undefined])
      }})

      it("returns an empty 404 response", function() { with(this) {
        get( "/storage/zebcoe/locog/seats", {} )
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
        get( "/storage/zebcoe/locog/seats", {} )
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
        put( "/storage/zebcoe/locog/seats", "a value" )
      }})

      it("tells the store to save a public value", function() { with(this) {
        expect(store, "put").given("zebcoe", "/public/locog/seats", "text/plain", buffer("a value"), null).yielding([null])
        put( "/storage/zebcoe/public/locog/seats", "a value" )
      }})

      it("tells the store to save a value conditionally based on If-None-Match", function() { with(this) {
        var date = new Date("Sat, 25 Feb 2012 13:37:00 GMT")
        expect(store, "put").given("zebcoe", "/locog/seats", "text/plain", buffer("a value"), date).yielding([null])
        header( "If-None-Match", date.getTime().toString() )
        put( "/storage/zebcoe/locog/seats", "a value" )
      }})

      it("tells the store to save a value conditionally based on If-Unmodified-Since", function() { with(this) {
        var date = new Date("Sat, 25 Feb 2012 13:37:00 GMT")
        expect(store, "put").given("zebcoe", "/locog/seats", "text/plain", buffer("a value"), date).yielding([null])
        header( "If-Unmodified-Since", date.toGMTString() )
        put( "/storage/zebcoe/locog/seats", "a value" )
      }})

      it("does not tell the store to save a directory", function() { with(this) {
        expect(store, "put").exactly(0)
        put( "/storage/zebcoe/locog/seats/", "a value" )
      }})

      it("does not tell the store to save to a write-unauthorized directory", function() { with(this) {
        expect(store, "put").exactly(0)
        put( "/storage/zebcoe/books/house_of_leaves", "a value" )
      }})
    }})

    describe("when an invalid access token is used", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer bad_token" )
      }})

      it("does not tell the store to save the given value", function() { with(this) {
        expect(store, "put").exactly(0)
        put( "/storage/zebcoe/locog/seats", "a value" )
      }})
    }})

    describe("when the store says the item was created", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "put").yields([null, true, new Date(1347016875231)])
      }})

      it("returns an empty 200 response", function() { with(this) {
        put( "/storage/zebcoe/locog/seats", "a value" )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "ETag", "1347016875231" )
        check_header( "Last-Modified", "Fri, 07 Sep 2012 11:21:15 GMT" )
        check_body( "" )
      }})
    }})

    describe("when the store says the item was not created but updated", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "put").yields([null, false, new Date(1347016875231)])
      }})

      it("returns an empty 200 response", function() { with(this) {
        put( "/storage/zebcoe/locog/seats", "a value" )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "ETag", "1347016875231" )
        check_header( "Last-Modified", "Fri, 07 Sep 2012 11:21:15 GMT" )
        check_body( "" )
      }})
    }})

    describe("when the store says there was a version conflict", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "put").yields([null, false, new Date(1347016875231), true])
      }})

      it("returns an empty 409 response", function() { with(this) {
        put( "/storage/zebcoe/locog/seats", "a value" )
        check_status( 409 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "ETag", "1347016875231" )
        check_header( "Last-Modified", "Fri, 07 Sep 2012 11:21:15 GMT" )
        check_body( "" )
      }})
    }})

    describe("when the store returns an error", function() { with(this) {
      before(function() { with(this) {
        header( "Authorization", "Bearer a_token" )
        stub(store, "put").yields([new Error("Something is technically wrong")])
      }})

      it("returns a 500 response with the error message", function() { with(this) {
        put( "/storage/zebcoe/locog/seats", "a value" )
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
      this.delete( "/storage/zebcoe/locog/seats", {} )
    }})

    it("tells the store to delete an item conditionally based on If-None-Match", function() { with(this) {
      var date = new Date("Sat, 25 Feb 2012 13:37:00 GMT")
      expect(store, "delete").given("zebcoe", "/locog/seats", date).yielding([null])
      header( "If-None-Match", date.getTime().toString() )
      this.delete( "/storage/zebcoe/locog/seats", {} )
    }})

    it("tells the store to delete an item conditionally based on If-Unmodified-Since", function() { with(this) {
      var date = new Date("Sat, 25 Feb 2012 13:37:00 GMT")
      expect(store, "delete").given("zebcoe", "/locog/seats", date).yielding([null])
      header( "If-Unmodified-Since", date.toGMTString() )
      this.delete( "/storage/zebcoe/locog/seats", {} )
    }})

    describe("when the store says the item was deleted", function() { with(this) {
      before(function() { with(this) {
        stub(store, "delete").yields([null, true, new Date(1358121717830)])
      }})

      it("returns an empty 200 response", function() { with(this) {
        this.delete( "/storage/zebcoe/locog/seats", {} )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "ETag", "1358121717830" )
        check_header( "Last-Modified", "Mon, 14 Jan 2013 00:01:57 GMT" )
        check_body( "" )
      }})
    }})

    describe("when the store says the item was not deleted", function() { with(this) {
      before(function() { with(this) {
        stub(store, "delete").yields([null, false, new Date(1358121717830)])
      }})

      it("returns an empty 404 response", function() { with(this) {
        this.delete( "/storage/zebcoe/locog/seats", {} )
        check_status( 404 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "" )
      }})
    }})

    describe("when the store says there was a version conflict", function() { with(this) {
      before(function() { with(this) {
        stub(store, "delete").yields([null, false, new Date(1358121717830), true])
      }})

      it("returns an empty 409 response", function() { with(this) {
        this.delete( "/storage/zebcoe/locog/seats", {} )
        check_status( 409 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "" )
      }})
    }})

    describe("when the store returns an error", function() { with(this) {
      before(function() { with(this) {
        stub(store, "delete").yields([new Error("OH NOES!")])
      }})

      it("returns a 500 response with the error message", function() { with(this) {
        this.delete( "/storage/zebcoe/locog/seats", {} )
        check_status( 500 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "OH NOES!" )
      }})
    }})
  }})
}})

