var fs   = require("fs"),
    path = require("path"),
    JS   = require("jstest")

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
        this.params = {username: "zebcoe", email: "zeb@example.com", password: "locog"}
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

      describe("with no email", function() { with(this) {
        before(function() { delete this.params.email })

        it("returns an error", function(resume) { with(this) {
          store.createUser(params, function(error) {
            resume(function() { assertEqual( "Email must not be blank", error.message ) })
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

      describe("with an existing user", function() { with(this) {
        before(function(resume) { with(this) {
          store.createUser({username: "zebcoe", email: "zeb@example.com", password: "hi"}, resume)
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
        store.createUser({username: "boris", email: "boris@example.com", password: "zipwire"}, resume)
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

        store.createUser({username: "boris", email: "boris@example.com", password: "dangle"}, function() {
          store.authorize("www.example.com", "boris", permissions, function(error, accessToken) {
            token = accessToken
            store.createUser({username: "zebcoe", email: "zeb@example.com", password: "locog"}, function() {
              store.authorize("admin.example.com", "zebcoe", {"": ["r","w"]}, function(error, accessToken) {
                rootToken = accessToken
                resume()
              })
            })
          })
        })
      }})

      describe("permissions", function() { with(this) {
        it("returns the user's authorizations", function(resume) { with(this) {
          store.permissions("boris", token, function(error, auths) {
            resume(function() {
              assertEqual( {
                  "/contacts/":   ["r"],
                  "/deep/dir/":   ["r","w"],
                  "/documents/":  ["w"],
                  "/photos/":     ["r","w"]
                }, auths )
            })
          })
        }})
      }})

      describe("queryToken", function() { with(this) {
        it("returns the user's authorizations", function(resume) { with(this) {
          store.queryToken("boris", token, function(error, auths) {
            resume(function() {
              assertEqual( [
                  "/contacts/:r",
                  "/public/contacts/:r",
                  "/deep/dir/:rw",
                  "/public/deep/dir/:rw",
                  "/documents/:rw",
                  "/public/documents/:rw",
                  "/photos/:rw",
                  "/public/photos/:rw"
                ].sort(), auths.sort() )
            })
          })
        }})
      }})

      describe("revokeAccess", function() { with(this) {
        before(function(resume) { with(this) {
          store.revokeAccess("boris", token, resume)
        }})

        it("removes the authorization from the store", function(resume) { with(this) {
          store.permissions("boris", token, function(error, auths) {
            resume(function() {
              assertEqual( {}, auths )
            })
          })
        }})
      }})
    }})

    describe("storage methods", function() { with(this) {
      before(function() { with(this) {
        this.date = Date.UTC(2012,1,25,13,37)
        this.oldDate = Date.UTC(1984,6,5,11,11)
        stub("new", "Date").returns({getTime: function() { return date }})
        stub(Date, "now").returns(date) // make Node 0.9 happy
      }})

      describe("put", function() { with(this) {
        before(function(resume) { with(this) {
          store.put("boris", "/photos/election", "image/jpeg", buffer("hair"), null, function() { resume() })
        }})

        it("sets the value of an item", function(resume) { with(this) {
          store.put("boris", "/photos/zipwire", "image/poster", buffer("vertibo"), null, function() {
            store.get("boris", "/photos/zipwire", null, function(error, item) {
              resume(function() { assertEqual( buffer("vertibo"), item.value ) })
            })
          })
        }})

        it("stores binary data", function(resume) { with(this) {
          store.put("boris", "/photos/whut", "image/jpeg", file("whut2.jpg"), null, function() {
            store.get("boris", "/photos/whut", null, function(error, item) {
              resume(function() { assertEqual( file("whut2.jpg"), item.value ) })
            })
          })
        }})

        it("sets the value of a public item", function(resume) { with(this) {
          store.put("boris", "/public/photos/zipwire", "image/poster", buffer("vertibo"), null, function() {
            store.get("boris", "/public/photos/zipwire", null, function(error, item) {
              resume(function(resume) {
                assertEqual( buffer("vertibo"), item.value )
                store.get("boris", "/photos/zipwire", null, function(error, item) {
                  resume(function() { assertNull( item ) })
                })
              })
            })
          })
        }})

        it("sets the value of a root item", function(resume) { with(this) {
          store.put("zebcoe", "/manifesto", "text/plain", buffer("gizmos"), null, function() {
            store.get("zebcoe", "/manifesto", null, function(error, item) {
              resume(function() { assertEqual( buffer("gizmos"), item.value ) })
            })
          })
        }})

        it("sets the value of a deep item", function(resume) { with(this) {
          store.put("boris", "/deep/dir/secret", "text/plain", buffer("gizmos"), null, function() {
            store.get("boris", "/deep/dir/secret", null, function(error, item) {
              resume(function() { assertEqual( buffer("gizmos"), item.value ) })
            })
          })
        }})

        it("returns true with a timestamp when a new item is created", function(resume) { with(this) {
          store.put("boris", "/photos/zipwire", "image/poster", buffer("vertibo"), null, function(error, created, modified, conflict) {
            resume(function() {
              assertNull( error )
              assert( created )
              assertEqual( date, modified )
              assert( !conflict )
            })
          })
        }})

        it("returns true with a timestamp when a new category is created", function(resume) { with(this) {
          store.put("boris", "/documents/zipwire", "image/poster", buffer("vertibo"), null, function(error, created, modified, conflict) {
            resume(function() {
              assertNull( error )
              assert( created )
              assertEqual( date, modified )
              assert( !conflict )
            })
          })
        }})

        it("returns false with a timestamp when an existing item is modified", function(resume) { with(this) {
          store.put("boris", "/photos/election", "text/plain", buffer("hair"), null, function(error, created, modified, conflict) {
            resume(function() {
              assertNull( error )
              assert( !created )
              assertEqual( date, modified )
              assert( !conflict )
            })
          })
        }})

        describe("for a nested document", function() { with(this) {
          before(function(resume) { with(this) {
            store.put("boris", "/photos/foo/bar/qux", "image/poster", buffer("vertibo"), null, resume)
          }})

          it("creates the parent directory", function(resume) { with(this) {
            store.get("boris", "/photos/foo/bar/", null, function(error, items) {
              resume(function() {
                assertEqual( { children: [{name: "qux", modified: date}], modified: date }, items )
              })
            })
          }})

          it("creates the grandparent directory", function(resume) { with(this) {
            store.get("boris", "/photos/foo/", null, function(error, items) {
              resume(function() {
                assertEqual( { children: [{name: "bar/", modified: date}], modified: date }, items )
              })
            })
          }})
        }})

        describe("versioning", function() { with(this) {
          it("does not set the value if a version is given for a non-existent item", function(resume) { with(this) {
            store.put("boris", "/photos/zipwire", "image/poster", buffer("vertibo"), date, function() {
              store.get("boris", "/photos/zipwire", null, function(error, item) {
                resume(function() { assertNull( item ) })
              })
            })
          }})

          it("sets the value if the given version is current", function(resume) { with(this) {
            store.put("boris", "/photos/election", "image/jpeg", buffer("mayor"), date, function() {
              store.get("boris", "/photos/election", null, function(error, item) {
                resume(function() { assertEqual( buffer("mayor"), item.value ) })
              })
            })
          }})

          it("does not set the value if the given version is not current", function(resume) { with(this) {
            store.put("boris", "/photos/election", "image/jpeg", buffer("mayor"), oldDate, function() {
              store.get("boris", "/photos/election", null, function(error, item) {
                resume(function() { assertEqual( buffer("hair"), item.value ) })
              })
            })
          }})
 
          it("returns false with no conflict when the given version is current", function(resume) { with(this) {
            store.put("boris", "/photos/election", "image/jpeg", buffer("mayor"), date, function(error, created, modified, conflict) {
              resume(function() {
                assertNull( error )
                assert( !created )
                assertEqual( date, modified )
                assert( !conflict )
              })
            })
          }})

          it("returns false with a conflict when the given version is not current", function(resume) { with(this) {
            store.put("boris", "/photos/election", "image/jpeg", buffer("mayor"), oldDate, function(error, created, modified, conflict) {
              resume(function() {
                assertNull( error )
                assert( !created )
                assertNull( modified )
                assert( conflict )
              })
            })
          }})
        }})
      }})

      describe("get", function() { with(this) {
        describe("for documents", function() { with(this) {
          before(function(resume) { with(this) {
            store.put("boris", "/photos/zipwire", "image/poster", buffer("vertibo"), null, resume)
          }})

          it("returns an existing resource", function(resume) { with(this) {
            store.get("boris", "/photos/zipwire", null, function(error, item, match) {
              resume(function() {
                assertNull( error )
                assertEqual( {length: 7, type: "image/poster", modified: date, value: buffer("vertibo")}, item )
                assert( !match )
              })
            })
          }})

          it("returns null for a non-existant key", function(resume) { with(this) {
            store.get("boris", "/photos/lympics", null, function(error, item, match) {
              resume(function() {
                assertNull( error )
                assertNull( item )
                assert( !match )
              })
            })
          }})

          it("returns null for a non-existant category", function(resume) { with(this) {
            store.get("boris", "/madeup/lympics", null, function(error, item, match) {
              resume(function() {
                assertNull( error )
                assertNull( item )
                assert( !match )
              })
            })
          }})

          describe("versioning", function() { with(this) {
            it("returns a match if the given version is current", function(resume) { with(this) {
              store.get("boris", "/photos/zipwire", date, function(error, item, match) {
                resume(function() {
                  assertNull( error )
                  assertEqual( {length: 7, type: "image/poster", modified: date, value: buffer("vertibo")}, item )
                  assert( match )
                })
              })
            }})

            it("returns no match if the given version is not current", function(resume) { with(this) {
              store.get("boris", "/photos/zipwire", oldDate, function(error, item, match) {
                resume(function() {
                  assertNull( error )
                  assertEqual( {length: 7, type: "image/poster", modified: date, value: buffer("vertibo")}, item )
                  assert( !match )
                })
              })
            }})
          }})
        }})

        describe("for directories", function() { with(this) {
          before(function(resume) { with(this) {
            // Example data taken from http://www.w3.org/community/unhosted/wiki/RemoteStorage-2012.04#GET
            store.put("boris", "/photos/bar/baz/boo", "text/plain", buffer("some content"), null, function() {
              store.put("boris", "/photos/bla", "application/json", buffer('{"more": "content"}'), null, function() {
                store.put("zebcoe", "/tv/shows", "application/json", buffer('{"The Day": "Today"}'), null, resume)
              })
            })
          }})

          it("returns a directory listing for a category", function(resume) { with(this) {
            store.get("boris", "/photos/", null, function(error, items) {
              resume(function() {
                assertNull( error )
                assertEqual( { children: [{name: "bar/", modified: date}, {name: "bla", modified: date}], modified: date }, items )
              })
            })
          }})

          it("returns a directory listing for the root category", function(resume) { with(this) {
            store.get("zebcoe", "/", null, function(error, items) {
              resume(function() {
                assertNull( error )
                assertEqual( { children: [{name: "tv/", modified: date}], modified: date }, items )
              })
            })
          }})

          it("returns null for a non-existant directory", function(resume) { with(this) {
            store.get("boris", "/photos/foo/", null, function(error, items) {
              resume(function() {
                assertNull( error )
                assertEqual( null, items )
              })
            })
          }})

          describe("with a document with the same name as a directory", function() { with(this) {
            before(function(resume) { with(this) {
              store.put("boris", "/photos.d", "application/json", buffer('{"The Day": "Today"}'), null, function(error) {
                resume(function() { assertNull( error ) })
              })
            }})

            it("returns a directory listing for a category", function(resume) { with(this) {
              store.get("boris", "/photos/", null, function(error, items) {
                resume(function() {
                  assertNull( error )
                  assertEqual( { children: [{name: "bar/", modified: date}, {name: "bla", modified: date}], modified: date }, items )
                })
              })
            }})
          }})
        }})
      }})

      describe("delete", function() { with(this) {
        before(function(resume) { with(this) {
          store.put("boris", "/photos/election", "image/jpeg", buffer("hair"), null, function() {
            store.put("boris", "/photos/bar/baz/boo", "text/plain", buffer("some content"), null, resume)
          })
        }})

        it("deletes an item", function(resume) { with(this) {
          store.delete("boris", "/photos/election", null, function() {
            store.get("boris", "/photos/election", null, function(error, item) {
              resume(function() { assertNull( item ) })
            })
          })
        }})

        it("removes empty directories when items are deleted", function(resume) { with(this) {
          store.delete("boris", "/photos/bar/baz/boo", null, function() {
            store.get("boris", "/photos/", null, function(error, items) {
              resume(function() {
                assertNotEqual( arrayIncluding(objectIncluding({name: "bar/"})), items )
              })
            })
          })
        }})

        it("returns true when an existing item is deleted", function(resume) { with(this) {
          store.delete("boris", "/photos/election", null, function(error, deleted, modified, conflict) {
            resume(function() {
              assertNull( error )
              assert( deleted )
              assertEqual( date, modified )
              assert( !conflict )
            })
          })
        }})

        it("returns false when a non-existant item is deleted", function(resume) { with(this) {
          store.delete("boris", "/photos/zipwire", null, function(error, deleted, modified, conflict) {
            resume(function() {
              assertNull( error )
              assert( !deleted )
              assertNull( modified )
              assert( !conflict )
            })
          })
        }})

        describe("versioning", function() { with(this) {
          it("deletes the item if the given version is current", function(resume) { with(this) {
            store.delete("boris", "/photos/election", date, function() {
              store.get("boris", "/photos/election", null, function(error, item) {
                resume(function() { assertNull( item ) })
              })
            })
          }})

          it("does not delete the item if the given version is not current", function(resume) { with(this) {
            store.delete("boris", "/photos/election", oldDate, function() {
              store.get("boris", "/photos/election", null, function(error, item) {
                resume(function() { assertEqual( buffer("hair"), item.value ) })
              })
            })
          }})

          it("returns true with no conflict if the given version is current", function(resume) { with(this) {
            store.delete("boris", "/photos/election", date, function(error, deleted, modified, conflict) {
              resume(function() {
                assertNull( error )
                assert( deleted )
                assertEqual( date, modified )
                assert( !conflict )
              })
            })
          }})
 
          it("returns false with a conflict if the given version is not current", function(resume) { with(this) {
            store.delete("boris", "/photos/election", oldDate, function(error, deleted, modified, conflict) {
              resume(function() {
                assertNull( error )
                assert( !deleted )
                assertNull( modified )
                assert( conflict )
              })
            })
          }})
        }})
      }})
    }})
    describe("item storage methods", function() { with(this) {
      it("sets the value of an item", function(resume) { with(this) {
        store.putItem("boris", "test:/photos/zipwire", buffer("vertibo"), function(err1) {
          store.getItem("boris", "test:/photos/zipwire", function(err2, item) {
            resume(function() {
              assertEqual( err1, null )
              assertEqual( err2, null )
              assertEqual( buffer("vertibo"), item )
            })
          })
        })
      }})

      it("stores binary data", function(resume) { with(this) {
        store.putItem("boris", "test:/photos/whut", file("whut2.jpg"), function(err1) {
          store.getItem("boris", "test:/photos/whut", function(err2, item) {
            resume(function() {
              assertEqual( err1, null )
              assertEqual( err2, null )
              assertEqual( file("whut2.jpg"), item )
            })
          })
        })
      }})
      
      it("deletes the value of an item", function(resume) { with(this) {
        store.putItem("boris", "test:/photos/zipwire", buffer("vertibo"), function(err1) {
          store.getItem("boris", "test:/photos/zipwire", function(err2, item2) {
            store.deleteItem("boris", "test:/photos/zipwire", function(err3) {
              store.getItem("boris", "test:/photos/zipwire", function(err4, item4) {
                resume(function() {
                  assertEqual( err1, null )
                  assertEqual( err2, null )
                  assertEqual( err3, null )
                  assertEqual( err4, null )
                  assertEqual( buffer("vertibo"), item2 )
                  assertEqual( undefined, item4 )
                })
              })
            })
          })
        })
      }})
    }})

  }})
}})

