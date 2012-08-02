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
  
  describe("GET", function() { with(this) {
    define("item", {
      type:     "custom/type",
      modified: new Date(2012, 1, 25, 13, 37),
      value:    "a value"
    })
    
    it("asks the store for the item using an access token", function() { with(this) {
      expect(store, "get").given("a_token", "zebcoe", "locog", "seats").yielding([null, item])
      header( "Authorization", "Bearer a_token" )
      get( "/data/zebcoe/locog/seats", {} )
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
        check_header( "Content-Type", "custom/type" )
        check_header( "Last-Modified", /^Sat Feb 25 2012 13:37:00 GMT\+0000 \(.*?\)$/ )
        check_body( "a value" )
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
        stub(store, "get").yields([new Error(), undefined])
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
      expect(store, "put").given("a_token", "zebcoe", "locog", "seats", "text/plain", "a value").yielding([null])
      header( "Authorization", "Bearer a_token" )
      put( "/data/zebcoe/locog/seats", "a value" )
    }})
    
    describe("when the store says the item was created", function() { with(this) {
      before(function() { with(this) {
        stub(store, "put").yields([null, true])
      }})
      
      it("returns an empty 201 response", function() { with(this) {
        put( "/data/zebcoe/locog/seats", "a value" )
        check_status( 201 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "" )
      }})
    }})
    
    describe("when the store says the item was not created but updated", function() { with(this) {
      before(function() { with(this) {
        stub(store, "put").yields([null, false])
      }})
      
      it("returns an empty 200 response", function() { with(this) {
        put( "/data/zebcoe/locog/seats", "a value" )
        check_status( 200 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "" )
      }})
    }})
    
    describe("when the store returns an error", function() { with(this) {
      before(function() { with(this) {
        stub(store, "put").yields([new Error()])
      }})
      
      it("returns an empty 401 response", function() { with(this) {
        put( "/data/zebcoe/locog/seats", "a value" )
        check_status( 401 )
        check_header( "Access-Control-Allow-Origin", "*" )
        check_body( "" )
      }})
    }})
  }})
  
  describe("DELETE", function() { with(this) {
    it("tells the store to delete the given item", function() { with(this) {
      expect(store, "delete").given("a_token", "zebcoe", "locog", "seats").yielding([null])
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
        stub(store, "delete").yields([new Error()])
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

