var File = require("../../lib/stores/file"),
    rmrf = require("rimraf")

JS.Test.describe("File store", function() { with(this) {
  before(function() { with(this) {
    stub(require("../../lib/stores/core"), "hashRounds", 1)
    this.store = new File({path: __dirname + "/../../tmp/store"})
  }})
  
  after(function(resume) { with(this) {
    rmrf(__dirname + "/../../tmp", resume)
  }})
  
  itShouldBehaveLike("storage backend")
}})

