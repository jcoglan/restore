JS.Test.describe("Stores", function() { with(this) {
  sharedBehavior("storage backend", function() { with(this) {
    describe("createUser", function() { with(this) {
      before(function() { with(this) {
        this.params = {username: "zebcoe", password: "locog"}
      }})
      
      describe("with valid parameters", function() { with(this) {
        it("returns no errors", function(resume) { with(this) {
          store.createUser(params, function(error) {
            resume(function() { assertNull( error ) })
          })
        }})
      }})
      
      describe("with no username", function() { with(this) {
        before(function() { delete this.params.username })
        
        it("returns an error", function(resume) { with(this) {
          store.createUser(params, function(error) {
            resume(function() {
              assertEqual( "Username must be at least 2 characters long", error.message )
            })
          })
        }})
      }})
      
      describe("with no password", function() { with(this) {
        before(function() { delete this.params.password })
        
        it("returns an error", function(resume) { with(this) {
          store.createUser(params, function(error) {
            resume(function() {
              assertEqual( "Password must not be blank", error.message )
            })
          })
        }})
      }})
      
      describe("with an exising user", function() { with(this) {
        before(function(resume) { with(this) {
          store.createUser({username: "zebcoe", password: "hi"}, resume)
        }})
        
        it("returns an error", function(resume) { with(this) {
          store.createUser(params, function(error) {
            resume(function() {
              assertEqual( "The username is already taken", error.message )
            })
          })
        }})
      }})
    }})
    
    describe("authenticate", function() { with(this) {
      before(function(resume) { with(this) {
        store.createUser({username: "boris", password: "zipwire"}, resume)
      }})
      
      it("returns no error for valid username-password pairs", function(resume) { with(this) {
        store.authenticate({username: "boris", password: "zipwire"}, function(error) {
          resume(function() { assertNull( error ) })
        })
      }})
      
      it("returns an error if the password is wrong", function(resume) { with(this) {
        store.authenticate({username: "boris", password: "bikes"}, function(error) {
          resume(function() {
            assertEqual( "Incorrect password", error.message )
          })
        })
      }})
      
      it("returns an error if the user does not exist", function(resume) { with(this) {
        store.authenticate({username: "zeb", password: "zipwire"}, function(error) {
          resume(function() {
            assertEqual( "Username not found", error.message )
          })
        })
      }})
    }})
  }})
}})

