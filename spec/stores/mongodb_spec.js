var MongoDB = require("../../lib/stores/mongodb");

JS.Test.describe("MongoDB store", function() { with(this) {
  before(function() { with(this) {
    stub(require("../../lib/stores/core"), "hashRounds", 1)
    store = new MongoDB({
      host:     "localhost",
      port:     27017,
      database: "restore-test"
    })
  }})

  after(function(resume) { with(this) {
    store.getClient(function(error, client) {
      client.dropDatabase(function(error, result) {
        client.close(function(error, result) {
          resume()
        })
      })
    })
  }})

  itShouldBehaveLike("storage backend")
}})

