var FileTree = require("../../lib/stores/file_tree"),
    rmrf     = require("rimraf"),
    JS       = require("jstest")

JS.Test.describe("FileTree store", function() { with(this) {
  before(function() { with(this) {
    stub(require("../../lib/stores/core"), "hashRounds", 1)
    this.store = new FileTree({path: __dirname + "/../../tmp/store"})
  }})

  after(function(resume) { with(this) {
    rmrf(__dirname + "/../../tmp", resume)
  }})

  itShouldBehaveLike("storage backend")
}})

