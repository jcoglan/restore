var Restore = require("../lib/restore"),
    http    = require("http"),
    qs      = require("querystring")

var request = function(self, host, port, method, path, params, callback) {
  var options = {
    host:     host,
    port:     port,
    method:   method,
    path:     path
  }
  var query = qs.stringify(params)
  
  if (method === "POST" || method === "PUT")
    options.headers = {"Content-Type": "application/x-www-form-urlencoded"}
  else if (query)
    options.path += '?' + query
  
  var request = http.request(options, function(response) {
    var body = ""
    response.addListener("data", function(c) { body += c.toString() })
    response.addListener("end", function() {
      response.body = body
      self.response = response
      callback()
    })
  })
  
  if (method === "POST" || method === "PUT")
    request.write(query)
  
  request.end()
}

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
    request(this, "localhost", this._port, "GET", path, params, callback)
  },
  
  post: function(path, params, callback) {
    request(this, "localhost", this._port, "POST", path, params, callback)
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

