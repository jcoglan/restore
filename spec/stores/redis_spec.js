var Redis = require("../../lib/stores/redis"),
    redis = require("redis")

JS.Test.describe("Redis store", function() { with(this) {
  before(function() { with(this) {
    stub(require("../../lib/stores/core"), "hashRounds", 1)
    this.store = new Redis({
      host:       "localhost",
      port:       6379,
      database:   1,
      namespace:  String(new Date().getTime())
    })
  }})

  after(function(resume) { with(this) {
    var db = redis.createClient(6379, "localhost")
    db.select(1, function() {
      db.flushdb(function() { resume() })
    })
  }})

  itShouldBehaveLike("storage backend")
}})

