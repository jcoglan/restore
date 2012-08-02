var File = require("../../lib/stores/file"),
    fs   = require("fs.extra")

JS.Test.describe("File store", function() { with(this) {
  before(function() { with(this) {
    stub(require("../../lib/stores/core"), "hashRounds", 1)
    this.store = new File(__dirname + "/../../tmp/store", {hashRounds: 1})
  }})
  
  after(function(resume) { with(this) {
    fs.rmrf(__dirname + "/../../tmp", function() { resume () })
  }})
  
  itShouldBehaveLike("storage backend")
}})

