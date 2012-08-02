var Restore = require("../lib/restore"),
    http    = require("http"),
    qs      = require("querystring")

module.exports = JS.Test.asyncSteps({
  start: function(port, callback) {
    this._server = new Restore({store: this.store})
    this._port = port
    this._server.listen(port)
    setTimeout(callback, 10)
  },
  
  stop: function(callback) {
    this._server.stop()
    setTimeout(callback, 10)
  },
  
  get: function(path, params, callback) {
    var self = this
    http.get({host: "localhost", port: this._port, path: path}, function(response) {
      var body = ""
      response.addListener("data", function(c) { body += c.toString() })
      response.addListener("end", function() {
        response.body = body
        self.response = response
        callback()
      })
    })
  },
  
  post: function(path, params, callback) {
    var self = this
    var request = http.request({
      host:     "localhost",
      port:     this._port,
      method:   "POST",
      path:     path,
      headers:  {"Content-Type": "application/x-www-form-urlencoded"}
    }, function(response) {
      var body = ""
      response.addListener("data", function(c) { body += c.toString() })
      response.addListener("end", function() {
        response.body = body
        self.response = response
        callback()
      })
    })
    request.write(qs.stringify(params))
    request.end()
  },
  
  check_status: function(status, callback) {
    this.assertEqual(status, this.response.statusCode)
    callback()
  },
  
  check_header: function(name, value, callback) {
    this.assertEqual(value, this.response.headers[name.toLowerCase()])
    callback()
  },
  
  check_body: function(expectedBody, callback) {
    var actualBody = this.response.body.replace(/^\s*|\s*$/g, '')
    if (typeof expectedBody === "string")
      this.assertEqual(expectedBody, actualBody)
    else
      this.assertMatch(expectedBody, actualBody)
    callback()
  }
})

