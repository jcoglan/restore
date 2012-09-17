var FileTree = require("../../lib/stores/file_tree"),
    fs       = require("fs.extra")

JS.Test.describe("FileTree store", function() { with(this) {
  before(function() { with(this) {
    stub(require("../../lib/stores/core"), "hashRounds", 1)
    this.store = new FileTree({path: __dirname + "/../../tmp/store"})
  }})
  
  after(function(resume) { with(this) {
    fs.rmrf(__dirname + "/../../tmp", resume)
  }})
  
  itShouldBehaveLike("storage backend")
}})

