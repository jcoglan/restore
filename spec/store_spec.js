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
            resume(function() { assertEqual( "Username must be at least 2 characters long", error.message ) })
          })
        }})
      }})
      
      describe("with no password", function() { with(this) {
        before(function() { delete this.params.password })
        
        it("returns an error", function(resume) { with(this) {
          store.createUser(params, function(error) {
            resume(function() { assertEqual( "Password must not be blank", error.message ) })
          })
        }})
      }})
      
      describe("with an exising user", function() { with(this) {
        before(function(resume) { with(this) {
          store.createUser({username: "zebcoe", password: "hi"}, resume)
        }})
        
        it("returns an error", function(resume) { with(this) {
          store.createUser(params, function(error) {
            resume(function() { assertEqual( "The username is already taken", error.message ) })
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
          resume(function() { assertEqual( "Incorrect password", error.message ) })
        })
      }})
      
      it("returns an error if the user does not exist", function(resume) { with(this) {
        store.authenticate({username: "zeb", password: "zipwire"}, function(error) {
          resume(function() { assertEqual( "Username not found", error.message ) })
        })
      }})
    }})
    
    describe("storage methods", function() { with(this) {
      before(function(resume) { with(this) {
        this.date = new Date(2012,1,25,13,37)
        stub("new", "Date").returns(date)
        stub(Date, "now").returns(date.getTime()) // make Node 0.9 happy
        
        this.token = null
        
        store.createUser({username: "boris", password: "dangle"}, function() {
          var permissions = {documents: ["w"], photos: ["r","w"], contacts: ["r"]}
          store.authorize("www.example.com", "boris", permissions, function(error, accessToken) {
            token = accessToken
            store.createUser({username: "zebcoe", password: "locog"}, resume)
          })
        })
      }})
      
      describe("put", function() { with(this) {
        before(function(resume) { with(this) {
          store.put(token, "boris", "/photos/election", "image/jpeg", "hair", function() { resume() })
        }})
        
        it("sets the value of an item", function(resume) { with(this) {
          store.put(token, "boris", "/photos/zipwire", "image/poster", "vertibo", function() {
            store.get(token, "boris", "/photos/zipwire", function(error, item) {
              resume(function() { assertEqual( "vertibo", item.value ) })
            })
          })
        }})
        
        it("does not set the value of a directory", function(resume) { with(this) {
          store.put(token, "boris", "/photos/zipwire/", "image/poster", "vertibo", function() {
            store.get(token, "boris", "/photos/", function(error, items) {
              resume(function() {
                assertNotEqual( arrayIncluding(objectIncluding({name: "zipwire/"})), items )
              })
            })
          })
        }})
        
        it("returns true with a timestamp when a new item is created", function(resume) { with(this) {
          store.put(token, "boris", "/photos/zipwire", "image/poster", "vertibo", function(error, created, modified) {
            resume(function() {
              assertNull( error )
              assert( created )
              assertEqual( date, modified )
            })
          })
        }})
        
        it("returns true with a timestamp when a new category is created", function(resume) { with(this) {
          store.put(token, "boris", "/documents/zipwire", "image/poster", "vertibo", function(error, created, modified) {
            resume(function() {
              assertNull( error )
              assert( created )
              assertEqual( date, modified )
            })
          })
        }})
        
        it("returns false with a timestamp when an existing item is modified", function(resume) { with(this) {
          store.put(token, "boris", "/photos/election", "text/plain", "hair", function(error, created, modified) {
            resume(function() {
              assertNull( error )
              assert( !created )
              assertEqual( date, modified )
            })
          })
        }})
        
        it("returns false when writing to a directory", function(resume) { with(this) {
          store.put(token, "boris", "/photos/election/", "text/plain", "hair", function(error, created) {
            resume(function() {
              assertNull( error )
              assert( !created )
            })
          })
        }})
        
        it("returns an error when the token is modified", function(resume) { with(this) {
          token = token.replace(/[a-e]/g, "x")
          store.put(token, "boris", "/photos/zipwire", "image/poster", "vertibo", function(error, created) {
            resume(function() {
              assertEqual( "Invalid access token", error.message )
              assertEqual( 401, error.status )
              assertEqual( undefined, created )
            })
          })
        }})
        
        it("returns an error when writing to a write-unauthorized category", function(resume) { with(this) {
          store.put(token, "boris", "/contacts/zipwire", "image/poster", "vertibo", function(error, created) {
            resume(function() {
              assertEqual( "Invalid access token", error.message )
              assertEqual( 403, error.status )
              assertEqual( undefined, created )
            })
          })
        }})
        
        it("returns an error when writing to an unauthorized category", function(resume) { with(this) {
          store.put(token, "boris", "/calendar/zipwire", "image/poster", "vertibo", function(error, created) {
            resume(function() {
              assertEqual( "Invalid access token", error.message )
              assertEqual( 403, error.status )
              assertEqual( undefined, created )
            })
          })
        }})
        
        it("returns an error when writing to an unauthorized user", function(resume) { with(this) {
          store.put(token, "zebcoe", "/photos/zipwire", "image/poster", "vertibo", function(error, created) {
            resume(function() {
              assertEqual( "Invalid access token", error.message )
              assertEqual( 401, error.status )
              assertEqual( undefined, created )
            })
          })
        }})
        
        it("returns an error when writing to a non-existant user", function(resume) { with(this) {
          store.put(token, "roderick", "/photos/zipwire", "image/poster", "vertibo", function(error, created) {
            resume(function() {
              assertEqual( "Invalid access token", error.message )
              assertEqual( 401, error.status )
              assertEqual( undefined, created )
            })
          })
        }})
        
        describe("for a nested document", function() { with(this) {
          before(function(resume) { with(this) {
            store.put(token, "boris", "/photos/foo/bar/qux", "image/poster", "vertibo", resume)
          }})
          
          it("creates the parent directory", function(resume) { with(this) {
            store.get(token, "boris", "/photos/foo/bar/", function(error, items) {
              resume(function() {
                assertEqual( [{name: "qux", modified: date}], items )
              })
            })
          }})
          
          it("creates the grandparent directory", function(resume) { with(this) {
            store.get(token, "boris", "/photos/foo/", function(error, items) {
              resume(function() {
                assertEqual( [{name: "bar/", modified: date}], items )
              })
            })
          }})
        }})
      }})
      
      describe("get", function() { with(this) {
        describe("for documents", function() { with(this) {
          before(function(resume) { with(this) {
            store.put(token, "boris", "/photos/zipwire", "image/poster", "vertibo", resume)
          }})
          
          it("returns an existing resource", function(resume) { with(this) {
            store.get(token, "boris", "/photos/zipwire", function(error, item) {
              resume(function() {
                assertNull( error )
                assertEqual( {type: "image/poster", modified: date, value: "vertibo"}, item )
              })
            })
          }})
          
          it("returns null for a non-existant key", function(resume) { with(this) {
            store.get(token, "boris", "/photos/lympics", function(error, item) {
              resume(function() {
                assertNull( error )
                assertNull( item )
              })
            })
          }})
          
          it("returns null for a non-existant category", function(resume) { with(this) {
            store.get(token, "boris", "/contacts/zipwire", function(error, item) {
              resume(function() {
                assertNull( error )
                assertNull( item )
              })
            })
          }})
          
          it("returns an error for a read-unauthorized category", function(resume) { with(this) {
            store.get(token, "boris", "/documents/zipwire", function(error, item) {
              resume(function() {
                assertEqual( "Invalid access token", error.message )
                assertEqual( 403, error.status )
                assertEqual( undefined, item )
              })
            })
          }})
          
          it("returns an error for an unauthorized category", function(resume) { with(this) {
            store.get(token, "boris", "/calendar/zipwire", function(error, item) {
              resume(function() {
                assertEqual( "Invalid access token", error.message )
                assertEqual( 403, error.status )
                assertEqual( undefined, item )
              })
            })
          }})
          
          it("returns an error for a non-existant user", function(resume) { with(this) {
            store.get(token, "roderick", "/photos/zipwire", function(error, item) {
              resume(function() {
                assertEqual( "Invalid access token", error.message )
                assertEqual( 401, error.status )
                assertEqual( undefined, item )
              })
            })
          }})
          
          it("returns an error for an unauthorized user", function(resume) { with(this) {
            store.get(token, "zebcoe", "/photos/zipwire", function(error, item) {
              resume(function() {
                assertEqual( "Invalid access token", error.message )
                assertEqual( 401, error.status )
                assertEqual( undefined, item )
              })
            })
          }})
        }})
        
        describe("for directories", function() { with(this) {
          before(function(resume) { with(this) {
            // Example data taken from http://www.w3.org/community/unhosted/wiki/RemoteStorage-2012.04#GET
            store.put(token, "boris", "/photos/bar/baz/boo", "text/plain", "some content", function() {
              store.put(token, "boris", "/photos/bla", "application/json", '{"more": "content"}', resume)
            })
          }})
          
          it("returns a directory listing for a category", function(resume) { with(this) {
            store.get(token, "boris", "/photos/", function(error, items) {
              resume(function() {
                assertNull( error )
                assertEqual( [{name: "bar/", modified: date}, {name: "bla", modified: date}], items )
              })
            })
          }})
          
          it("returns an empty listing for a non-existant directory", function(resume) { with(this) {
            store.get(token, "boris", "/photos/foo/", function(error, items) {
              resume(function() {
                assertNull( error )
                assertEqual( [], items )
              })
            })
          }})
        }})
        
        describe("for public resources", function() { with(this) {
          before(function(resume) { with(this) {
            store.put(token, "boris", "/public/photos/zipwire", "image/poster", "vertibo", resume)
          }})
          
          it("returns an existing resource with authorization", function(resume) { with(this) {
            store.get(token, "boris", "/public/photos/zipwire", function(error, item) {
              resume(function() {
                assertNull( error )
                assertEqual( {type: "image/poster", modified: date, value: "vertibo"}, item )
              })
            })
          }})
          
          it("returns an existing resource without authorization", function(resume) { with(this) {
            store.get("", "boris", "/public/photos/zipwire", function(error, item) {
              resume(function() {
                assertNull( error )
                assertEqual( {type: "image/poster", modified: date, value: "vertibo"}, item )
              })
            })
          }})
          
          it("returns a directory listing with authorization", function(resume) { with(this) {
            store.get(token, "boris", "/public/photos/", function(error, items) {
              resume(function() {
                assertNull( error )
                assertEqual( [{name: "zipwire", modified: date}], items )
              })
            })
          }})
          
          it("returns an error for a directory listing without authorization", function(resume) { with(this) {
            store.get("", "boris", "/public/photos/", function(error, items) {
              resume(function() {
                assertEqual( "Invalid access token", error.message )
                assertEqual( undefined, items )
              })
            })
          }})
        }})
      }})
      
      describe("delete", function() { with(this) {
        before(function(resume) { with(this) {
          store.put(token, "boris", "/photos/election", "image/jpeg", "hair", function() {
            store.put(token, "boris", "/photos/bar/baz/boo", "text/plain", "some content", resume)
          })
        }})
        
        it("deletes an item", function(resume) { with(this) {
          store.delete(token, "boris", "/photos/election", function() {
            store.get(token, "boris", "/photos/election", function(error, item) {
              resume(function() { assertNull( item ) })
            })
          })
        }})
        
        it("does not delete a directory", function(resume) { with(this) {
          store.delete(token, "boris", "/photos/bar/baz/", function() {
            store.get(token, "boris", "/photos/bar/baz/boo", function(error, item) {
              resume(function() {
                assertEqual( {type: "text/plain", modified: date, value: "some content"}, item )
              })
            })
          })
        }})
        
        it("removes empty directories when items are deleted", function(resume) { with(this) {
          store.delete(token, "boris", "/photos/bar/baz/boo", function() {
            store.get(token, "boris", "/photos/", function(error, items) {
              resume(function() {
                assertNotEqual( arrayIncluding(objectIncluding({name: "bar/"})), items )
              })
            })
          })
        }})
        
        it("returns true when an existing item is deleted", function(resume) { with(this) {
          store.delete(token, "boris", "/photos/election", function(error, deleted) {
            resume(function() {
              assertNull( error )
              assert( deleted )
            })
          })
        }})
        
        it("returns false when a non-existant item is deleted", function(resume) { with(this) {
          store.delete(token, "boris", "/photos/zipwire", function(error, deleted) {
            resume(function() {
              assertNull( error )
              assert( !deleted )
            })
          })
        }})
        
        it("returns false when deleting a directory", function(resume) { with(this) {
          store.delete(token, "boris", "/photos/bar/baz/", function(error, deleted) {
            resume(function() {
              assertNull( error )
              assert( !deleted )
            })
          })
        }})
        
        it("returns an error when the token is modified", function(resume) { with(this) {
          token = token.replace(/[a-e]/g, "x")
          store.delete(token, "boris", "/photos/zipwire", function(error, deleted) {
            resume(function() {
              assertEqual( "Invalid access token", error.message )
              assertEqual( 401, error.status )
              assertEqual( undefined, deleted )
            })
          })
        }})
        
        it("returns an error when deleting from a write-unauthorized category", function(resume) { with(this) {
          store.delete(token, "boris", "/contacts/zipwire", function(error, deleted) {
            resume(function() {
              assertEqual( "Invalid access token", error.message )
              assertEqual( 403, error.status )
              assertEqual( undefined, deleted )
            })
          })
        }})
        
        it("returns an error when deleting from an unauthorized category", function(resume) { with(this) {
          store.delete(token, "boris", "/calendar/zipwire", function(error, deleted) {
            resume(function() {
              assertEqual( "Invalid access token", error.message )
              assertEqual( 403, error.status )
              assertEqual( undefined, deleted )
            })
          })
        }})
        
        it("returns an error when deleting from an unauthorized user", function(resume) { with(this) {
          store.delete(token, "zebcoe", "/photos/zipwire", function(error, deleted) {
            resume(function() {
              assertEqual( "Invalid access token", error.message )
              assertEqual( 401, error.status )
              assertEqual( undefined, deleted )
            })
          })
        }})
        
        it("returns an error when deleting from a non-existant user", function(resume) { with(this) {
          store.delete(token, "roderick", "/photos/zipwire", function(error, deleted) {
            resume(function() {
              assertEqual( "Invalid access token", error.message )
              assertEqual( 401, error.status )
              assertEqual( undefined, deleted )
            })
          })
        }})
      }})
    }})
  }})
}})

