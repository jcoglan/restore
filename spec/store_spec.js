var fs   = require("fs"),
    path = require("path")

JS.Test.describe("Stores", function() { with(this) {
  sharedBehavior("storage backend", function() { with(this) {
    define("buffer", function(string) {
      var buffer = new Buffer(string)
      buffer.equals = function(other) {
        return other instanceof Buffer && other.toString("utf8") === string
      }
      return buffer
    })

    define("file", function(filename) {
      var buffer = fs.readFileSync(path.join(__dirname, filename)),
          string = buffer.toString("hex")

      buffer.equals = function(other) {
        return other instanceof Buffer && other.toString("hex") === string
      }
      return buffer
    })

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

    describe("authorization methods", function() { with(this) {
      before(function(resume) { with(this) {
        this.token = null
        this.rootToken = null
        var permissions = {documents: ["w"], photos: ["r","w"], contacts: ["r"], "deep/dir": ["r","w"]}

        store.createUser({username: "boris", password: "dangle"}, function() {
          store.authorize("www.example.com", "boris", permissions, function(error, accessToken) {
            token = accessToken
            store.createUser({username: "zebcoe", password: "locog"}, function() {
              store.authorize("admin.example.com", "zebcoe", {"": ["r","w"]}, function(error, accessToken) {
                rootToken = accessToken
                resume()
              })
            })
          })
        })
      }})

      describe("authorizations", function() { with(this) {
        it("returns the user's authorizations", function(resume) { with(this) {
          store.authorizations("boris", function(error, auths) {
            resume(function() {
              assertEqual( {
                  "www.example.com": {
                    "/contacts/":   ["r"],
                    "/deep/dir/":   ["r","w"],
                    "/documents/":  ["w"],
                    "/photos/":     ["r","w"]
                  }
                }, auths )
            })
          })
        }})
      }})

      describe("clientForToken", function() { with(this) {
        it("returns the client for a valid token/user pair", function(resume) { with(this) {
          store.clientForToken("boris", token, function(error, clientId) {
            resume(function() {
              assertNull( error )
              assertEqual( "www.example.com", clientId )
            })
          })
        }})

        it("returns an error for the wrong user", function(resume) { with(this) {
          store.clientForToken("zebcoe", token, function(error, clientId) {
            resume(function() { assert( error ) })
          })
        }})

        it("returns an error for the wrong token", function(resume) { with(this) {
          store.clientForToken("boris", rootToken, function(error, clientId) {
            resume(function() { assert( error ) })
          })
        }})
      }})
    }})

    describe("storage methods", function() { with(this) {
      before(function() { with(this) {
        this.date = new Date(2012,1,25,13,37)
        stub("new", "Date").returns(date)
        stub(Date, "now").returns(date.getTime()) // make Node 0.9 happy
      }})

      describe("put", function() { with(this) {
        before(function(resume) { with(this) {
          store.put("boris", "/photos/election", "image/jpeg", new Buffer("hair"), function() { resume() })
        }})

        it("sets the value of an item", function(resume) { with(this) {
          store.put("boris", "/photos/zipwire", "image/poster", buffer("vertibo"), function() {
            store.get("boris", "/photos/zipwire", function(error, item) {
              resume(function() { assertEqual( buffer("vertibo"), item.value ) })
            })
          })
        }})

        it("stores binary data", function(resume) { with(this) {
          store.put("boris", "/photos/whut", "image/jpeg", file("whut2.jpg"), function() {
            store.get("boris", "/photos/whut", function(error, item) {
              resume(function() { assertEqual( file("whut2.jpg"), item.value ) })
            })
          })
        }})

        it("sets the value of a public item", function(resume) { with(this) {
          store.put("boris", "/public/photos/zipwire", "image/poster", buffer("vertibo"), function() {
            store.get("boris", "/public/photos/zipwire", function(error, item) {
              resume(function(resume) {
                assertEqual( buffer("vertibo"), item.value )
                store.get("boris", "/photos/zipwire", function(error, item) {
                  resume(function() { assertNull( item ) })
                })
              })
            })
          })
        }})

        it("sets the value of a root item", function(resume) { with(this) {
          store.put("zebcoe", "/manifesto", "text/plain", buffer("gizmos"), function() {
            store.get("zebcoe", "/manifesto", function(error, item) {
              resume(function() { assertEqual( buffer("gizmos"), item.value ) })
            })
          })
        }})

        it("sets the value of a deep item", function(resume) { with(this) {
          store.put("boris", "/deep/dir/secret", "text/plain", buffer("gizmos"), function() {
            store.get("boris", "/deep/dir/secret", function(error, item) {
              resume(function() { assertEqual( buffer("gizmos"), item.value ) })
            })
          })
        }})

        it("returns true with a timestamp when a new item is created", function(resume) { with(this) {
          store.put("boris", "/photos/zipwire", "image/poster", buffer("vertibo"), function(error, created, modified) {
            resume(function() {
              assertNull( error )
              assert( created )
              assertEqual( date, modified )
            })
          })
        }})

        it("returns true with a timestamp when a new category is created", function(resume) { with(this) {
          store.put("boris", "/documents/zipwire", "image/poster", buffer("vertibo"), function(error, created, modified) {
            resume(function() {
              assertNull( error )
              assert( created )
              assertEqual( date, modified )
            })
          })
        }})

        it("returns false with a timestamp when an existing item is modified", function(resume) { with(this) {
          store.put("boris", "/photos/election", "text/plain", buffer("hair"), function(error, created, modified) {
            resume(function() {
              assertNull( error )
              assert( !created )
              assertEqual( date, modified )
            })
          })
        }})

        describe("for a nested document", function() { with(this) {
          before(function(resume) { with(this) {
            store.put("boris", "/photos/foo/bar/qux", "image/poster", buffer("vertibo"), resume)
          }})

          it("creates the parent directory", function(resume) { with(this) {
            store.get("boris", "/photos/foo/bar/", function(error, items) {
              resume(function() {
                assertEqual( [{name: "qux", modified: date}], items )
              })
            })
          }})

          it("creates the grandparent directory", function(resume) { with(this) {
            store.get("boris", "/photos/foo/", function(error, items) {
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
            store.put("boris", "/photos/zipwire", "image/poster", buffer("vertibo"), resume)
          }})

          it("returns an existing resource", function(resume) { with(this) {
            store.get("boris", "/photos/zipwire", function(error, item) {
              resume(function() {
                assertNull( error )
                assertEqual( {type: "image/poster", modified: date, value: buffer("vertibo")}, item )
              })
            })
          }})

          it("returns null for a non-existant key", function(resume) { with(this) {
            store.get("boris", "/photos/lympics", function(error, item) {
              resume(function() {
                assertNull( error )
                assertNull( item )
              })
            })
          }})

          it("returns null for a non-existant category", function(resume) { with(this) {
            store.get("boris", "/madeup/lympics", function(error, item) {
              resume(function() {
                assertNull( error )
                assertNull( item )
              })
            })
          }})
        }})

        describe("for directories", function() { with(this) {
          before(function(resume) { with(this) {
            // Example data taken from http://www.w3.org/community/unhosted/wiki/RemoteStorage-2012.04#GET
            store.put("boris", "/photos/bar/baz/boo", "text/plain", buffer("some content"), function() {
              store.put("boris", "/photos/bla", "application/json", buffer('{"more": "content"}'), function() {
                store.put("zebcoe", "/tv/shows", "application/json", buffer('{"The Day": "Today"}'), resume)
              })
            })
          }})

          it("returns a directory listing for a category", function(resume) { with(this) {
            store.get("boris", "/photos/", function(error, items) {
              resume(function() {
                assertNull( error )
                assertEqual( [{name: "bar/", modified: date}, {name: "bla", modified: date}], items )
              })
            })
          }})

          it("returns a directory listing for the root category", function(resume) { with(this) {
            store.get("zebcoe", "/", function(error, items) {
              resume(function() {
                assertNull( error )
                assertEqual( [{name: "tv/", modified: date}], items )
              })
            })
          }})

          it("returns null for a non-existant directory", function(resume) { with(this) {
            store.get("boris", "/photos/foo/", function(error, items) {
              resume(function() {
                assertNull( error )
                assertEqual( null, items )
              })
            })
          }})
        }})
      }})

      describe("delete", function() { with(this) {
        before(function(resume) { with(this) {
          store.put("boris", "/photos/election", "image/jpeg", buffer("hair"), function() {
            store.put("boris", "/photos/bar/baz/boo", "text/plain", buffer("some content"), resume)
          })
        }})

        it("deletes an item", function(resume) { with(this) {
          store.delete("boris", "/photos/election", function() {
            store.get("boris", "/photos/election", function(error, item) {
              resume(function() { assertNull( item ) })
            })
          })
        }})

        it("removes empty directories when items are deleted", function(resume) { with(this) {
          store.delete("boris", "/photos/bar/baz/boo", function() {
            store.get("boris", "/photos/", function(error, items) {
              resume(function() {
                assertNotEqual( arrayIncluding(objectIncluding({name: "bar/"})), items )
              })
            })
          })
        }})

        it("returns true when an existing item is deleted", function(resume) { with(this) {
          store.delete("boris", "/photos/election", function(error, deleted) {
            resume(function() {
              assertNull( error )
              assert( deleted )
            })
          })
        }})

        it("returns false when a non-existant item is deleted", function(resume) { with(this) {
          store.delete("boris", "/photos/zipwire", function(error, deleted) {
            resume(function() {
              assertNull( error )
              assert( !deleted )
            })
          })
        }})
      }})
    }})
  }})
}})

