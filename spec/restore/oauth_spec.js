var RestoreSteps = require("../restore_steps")

JS.Test.describe("OAuth", function() { with(this) {
  include(RestoreSteps)
  
  before(function() { this.start(4567) })
  after (function() { this.stop() })
  
  define("store", {})
  
  before(function() { with(this) {
    this.auth_params = {
      username:       "zebcoe",
      password:       "locog",
      client_id:      "the_client_id",
      redirect_uri:   "http://example.com/cb",
      response_type:  "token",
      scope:          "the_scope",
      state:          "the_state"
    }
  }})
  
  describe("with valid login credentials", function() { with(this) {
    before(function() { with(this) {
      expect(store, "authenticate")
          .given( objectIncluding({username: "zebcoe", password: "locog"}) )
          .yielding( [null] )
    }})
    
    describe("without explicit read/write permissions", function() { with(this) {
      before(function() { this.auth_params.scope = "the_scope" })
        
      it("authorizes the client to read and write", function() { with(this) {
        expect(store, "authorize").given("the_client_id", "zebcoe", {the_scope: ["r", "w"]}).yielding([null, "a_token"])
        post("/oauth", auth_params)
      }})
    }})
    
    describe("with explicit read permission", function() { with(this) {
      before(function() { this.auth_params.scope = "the_scope:r" })
        
      it("authorizes the client to read", function() { with(this) {
        expect(store, "authorize").given("the_client_id", "zebcoe", {the_scope: ["r"]}).yielding([null, "a_token"])
        post("/oauth", auth_params)
      }})
    }})
    
    describe("with explicit read/write permission", function() { with(this) {
      before(function() { this.auth_params.scope = "the_scope:rw" })
        
      it("authorizes the client to read and write", function() { with(this) {
        expect(store, "authorize").given("the_client_id", "zebcoe", {the_scope: ["r", "w"]}).yielding([null, "a_token"])
        post("/oauth", auth_params)
      }})
    }})
    
    it("redirects with an access token", function() { with(this) {
      stub(store, "authorize").yields([null, "a_token"])
      post("/oauth", auth_params)
      check_status( 302 )
      check_header( "Location", "http://example.com/cb#access_token=a_token&state=the_state" )
    }})
  }})
  
  describe("with invalid login credentials", function() { with(this) {
    before(function() { with(this) {
      expect(store, "authenticate")
          .given( objectIncluding({username: "zebcoe", password: "locog"}) )
          .yielding( [new Error()] )
    }})
    
    it("does not authorize the client", function() { with(this) {
      expect(store, "authorize").exactly(0)
      post("/oauth", auth_params)
    }})
    
    it("returns a 401 response with the login form", function() { with(this) {
      post("/oauth", auth_params)
      check_status( 401 )
      check_header( "Content-Type","text/html" )
      check_body( /<code>the_client_id<\/code> wants/ )
    }})
  }})
}})

