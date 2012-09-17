var RestoreSteps = require("../restore_steps")

JS.Test.describe("Storage", function() { with(this) {
  include(RestoreSteps)
  
  before(function() { this.start(4567) })
  after (function() { this.stop() })
  
  define("store", {})
  
  describe("OPTIONS", function() { with(this) {
    it("returns access control headers", function() { with(this) {
      options( "/data/zebcoe/locog/seats", {} )
      check_status( 200 )
      check_header( "Access-Control-Allow-Origin", "*" )
      check_header( "Access-Control-Allow-Methods", "GET, PUT, DELETE" )
      check_header( "Access-Control-Allow-Headers", "Authorization, Content-Length, Content-Type, Origin, X-Requested-With" )
      check_header( "Cache-Control", "no-cache, no-store" )
      check_body( "" )
    }})
  }})
  
  it("returns a 400 if the client tries to walk up the directory tree", function() { with(this) {
    get( "/data/zebcoe/locog/../seats" )
    check_status( 400 )
    check_header( "Access-Control-Allow-Origin", "*" )
  }})
  
  describe("GET", function() { with(this) {
    define("item", {
      type:     "custom/type",
      modified: new Date(2012, 1, 25, 13, 37),
      value:    "a value"
    })
    
    it("asks the store for the item using an access token from a header", function() { with(this) {
      expect(store, "get").given("a_token", "zebcoe", "/locog/seats").yielding([null, item])
      header( "Authorization", "Bearer a_token" )
      get( "/data/zebcoe@local.dev/locog/seats", {} )
    }})
    
    it("asks the store for the item using an access token from the query string", function() { with(this) {
      expect(store, "get").given("a_token", "zebcoe", "/locog/seats").yielding([null, item])
      get( "/data/zebcoe/locog/seats?oauth_token=a_token", {} )
    }})
    
    it("asks the store for a directory listing using an access token", function() { with(this) {
      expect(store, "get").given("a_token", "zebcoe", "/locog/").yielding([null, item])
      header( "Authorization", "Bearer a_token" )
      get( "/data/zebcoe/locog/", {} )
    }})
    
    it("asks the store for a root listing using an access token", function() { with(this) {
      expect(store, "get").given("a_token", "zebcoe", "/").yielding([null, item])
      header( "Authorization", "Bearer a_token" )
      get( "/data/zebcoe/", {} )
    }})
    
    describe("when the store returns an item", function() { with(this) {
      before(function() { with(this) {
        stub(store, "get").yields([null, item])
      }})
      
      it("returns the value in the response", function() { with(this) {
        get( "/data/zebcoe/locog/seats", {} )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Cache-Control", "no-cache, no-store" )
        check_header( "Content-Length", "7" )
        check_header( "Content-Type", "custom/type" )
        check_header( "ETag", "a213df409c704f6efd96811206f894e2" )
        check_header( "Last-Modified", "Sat, 25 Feb 2012 13:37:00 GMT" )
        check_body( "a value" )
      }})
      
      it("returns a 304 for conditional GET with If-None-Match", function() { with(this) {
        header( "If-None-Match", "a213df409c704f6efd96811206f894e2" )
        get( "/data/zebcoe/locog/seats", {} )
        check_status( 304 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Cache-Control", "no-cache, no-store" )
        check_header( "Content-Length", "0" )
        check_header( "Content-Type", "custom/type" )
        check_header( "ETag", "a213df409c704f6efd96811206f894e2" )
        check_header( "Last-Modified", "Sat, 25 Feb 2012 13:37:00 GMT" )
        check_body( "" )
      }})
      
      it("returns a 304 for conditional GET with If-Modified-Since", function() { with(this) {
        header( "If-Modified-Since", "Fri, 24 Feb 2012 13:37:00 GMT" )
        get( "/data/zebcoe/locog/seats", {} )
        check_status( 304 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Cache-Control", "no-cache, no-store" )
        check_header( "Content-Length", "0" )
        check_header( "Content-Type", "custom/type" )
        check_header( "ETag", "a213df409c704f6efd96811206f894e2" )
        check_header( "Last-Modified", "Sat, 25 Feb 2012 13:37:00 GMT" )
        check_body( "" )
      }})
    }})
    
    describe("when the store returns a directory listing", function() { with(this) {
      before(function() { with(this) {
        stub(store, "get").yields([null, [{name: "bla", modified: new Date(1234544444)}, {name: "bar/", modified: new Date(12345888888)}]])
      }})
      
      it("returns the listing as JSON", function() { with(this) {
        get( "/data/zebcoe/locog/seats/", {} )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Cache-Control", "no-cache, no-store" )
        check_json( {"bar/": 12345888888, "bla": 1234544444} )
      }})
    }})
    
    describe("when the store returns an empty directory listing", function() { with(this) {
      before(function() { with(this) {
        stub(store, "get").yields([null, []])
      }})
      
      it("returns a 200 response with an empty JSON object", function() { with(this) {
        get( "/data/zebcoe/locog/seats/", {} )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Cache-Control", "no-cache, no-store" )
        check_json( {} )
      }})
    }})
    
    describe("when the item does not exist", function() { with(this) {
      before(function() { with(this) {
        stub(store, "get").yields([null, undefined])
      }})
      
      it("returns an empty 404 response", function() { with(this) {
        get( "/data/zebcoe/locog/seats", {} )
        check_status( 404 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "" )
      }})
    }})
    
    describe("when the store returns an error", function() { with(this) {
      before(function() { with(this) {
        stub(store, "get").yields([{status: 401}, undefined])
      }})
      
      it("returns an empty 401 response", function() { with(this) {
        get( "/data/zebcoe/locog/seats", {} )
        check_status( 401 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "" )
      }})
    }})
  }})
  
  describe("PUT", function() { with(this) {
    it("tells the store to save the given value", function() { with(this) {
      expect(store, "put").given("a_token", "zebcoe", "/locog/seats", "text/plain", "a value").yielding([null])
      header( "Authorization", "Bearer a_token" )
      put( "/data/zebcoe/locog/seats", "a value" )
    }})
    
    describe("when the store says the item was created", function() { with(this) {
      before(function() { with(this) {
        stub(store, "put").yields([null, true, new Date(1347016875231)])
      }})
      
      it("returns an empty 201 response", function() { with(this) {
        put( "/data/zebcoe/locog/seats", "a value" )
        check_status( 201 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Last-Modified", "Fri, 07 Sep 2012 11:21:15 GMT" )
        check_body( "" )
      }})
    }})
    
    describe("when the store says the item was not created but updated", function() { with(this) {
      before(function() { with(this) {
        stub(store, "put").yields([null, false, new Date(1347016875231)])
      }})
      
      it("returns an empty 200 response", function() { with(this) {
        put( "/data/zebcoe/locog/seats", "a value" )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_header( "Last-Modified", "Fri, 07 Sep 2012 11:21:15 GMT" )
        check_body( "" )
      }})
    }})
    
    describe("when the store returns an error", function() { with(this) {
      before(function() { with(this) {
        stub(store, "put").yields([{status: 403}])
      }})
      
      it("returns an empty 403 response", function() { with(this) {
        put( "/data/zebcoe/locog/seats", "a value" )
        check_status( 403 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "" )
      }})
    }})
  }})
  
  describe("DELETE", function() { with(this) {
    it("tells the store to delete the given item", function() { with(this) {
      expect(store, "delete").given("a_token", "zebcoe", "/locog/seats").yielding([null])
      header( "Authorization", "Bearer a_token" )
      this.delete( "/data/zebcoe/locog/seats", {} )
    }})
    
    describe("when the store says the item was deleted", function() { with(this) {
      before(function() { with(this) {
        stub(store, "delete").yields([null, true])
      }})
      
      it("returns an empty 200 response", function() { with(this) {
        this.delete( "/data/zebcoe/locog/seats", {} )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "" )
      }})
    }})
    
    describe("when the store says the item was not deleted", function() { with(this) {
      before(function() { with(this) {
        stub(store, "delete").yields([null, false])
      }})
      
      it("returns an empty 404 response", function() { with(this) {
        this.delete( "/data/zebcoe/locog/seats", {} )
        check_status( 404 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "" )
      }})
    }})
    
    describe("when the store returns an error", function() { with(this) {
      before(function() { with(this) {
        stub(store, "delete").yields([{status: 401}])
      }})
      
      it("returns an empty 401 response", function() { with(this) {
        this.delete( "/data/zebcoe/locog/seats", {} )
        check_status( 401 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "" )
      }})
    }})
  }})
}})

