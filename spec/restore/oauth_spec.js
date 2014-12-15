var RestoreSteps = require("../restore_steps"),
    JS = require("jstest")

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

  describe("with invalid client input", function() { with(this) {
    before(function() { delete this.auth_params.state })

    it("returns an error if redirect_uri is missing", function() { with(this) {
      delete auth_params.redirect_uri
      get("/oauth/me", auth_params)
      check_status( 400 )
      check_body( "error=invalid_request&error_description=Required%20parameter%20%22redirect_uri%22%20is%20missing" )
    }})

    it("returns an error if client_id is missing", function() { with(this) {
      delete auth_params.client_id
      get("/oauth/me", auth_params)
      check_redirect( "http://example.com/cb#error=invalid_request&error_description=Required%20parameter%20%22client_id%22%20is%20missing" )
    }})

    it("returns an error if response_type is missing", function() { with(this) {
      delete auth_params.response_type
      get("/oauth/me", auth_params)
      check_redirect( "http://example.com/cb#error=invalid_request&error_description=Required%20parameter%20%22response_type%22%20is%20missing" )
    }})

    it("returns an error if response_type is not recognized", function() { with(this) {
      auth_params.response_type = "wrong"
      get("/oauth/me", auth_params)
      check_redirect( "http://example.com/cb#error=unsupported_response_type&error_description=Response%20type%20%22wrong%22%20is%20not%20supported" )
    }})

    it("returns an error if scope is missing", function() { with(this) {
      delete auth_params.scope
      get("/oauth/me", auth_params)
      check_redirect( "http://example.com/cb#error=invalid_scope&error_description=Parameter%20%22scope%22%20is%20invalid" )
    }})

    it("returns an error if username is missing", function() { with(this) {
      delete auth_params.username
      post("/oauth", auth_params)
      check_status(400)
    }})
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
      check_redirect( "http://example.com/cb#access_token=a_token&token_type=bearer&state=the_state" )
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
      check_body( /application <em>the_client_id<\/em> hosted/ )
    }})
  }})
}})
