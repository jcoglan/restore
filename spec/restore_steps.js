var Restore = require("../lib/restore"),
    http    = require("http"),
    qs      = require("querystring")

var request = function(self, host, port, method, path, params, headers, callback) {
  var options = {
    host:     host,
    port:     port,
    method:   method,
    path:     path,
    headers:  headers || {}
  }
  var query = (typeof params === "string")
            ? params
            : qs.stringify(params)
  
  if ((method === "POST" || method === "PUT") && !options.headers["Content-Type"])
    options.headers["Content-Type"] = (typeof params === "object")
                                    ? "application/x-www-form-urlencoded"
                                    : "text/plain"
  else if (query)
    options.path += "?" + query
  
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
    process.nextTick(callback)
  },
  
  stop: function(callback) {
    this._server.stop()
    process.nextTick(callback)
  },
  
  header: function(name, value, callback) {
    this._headers = this._headers || {}
    this._headers[name] = value
    process.nextTick(callback)
  },
  
  get: function(path, params, callback) {
    request(this, "localhost", this._port, "GET", path, params, this._headers, callback)
  },
  
  post: function(path, params, callback) {
    request(this, "localhost", this._port, "POST", path, params, this._headers, callback)
  },
  
  put: function(path, params, callback) {
    request(this, "localhost", this._port, "PUT", path, params, this._headers, callback)
  },
  
  delete: function(path, params, callback) {
    request(this, "localhost", this._port, "DELETE", path, params, this._headers, callback)
  },
  
  options: function(path, params, callback) {
    request(this, "localhost", this._port, "OPTIONS", path, params, this._headers, callback)
  },
  
  check_status: function(status, callback) {
    this.assertEqual(status, this.response.statusCode)
    process.nextTick(callback)
  },
  
  check_header: function(name, value, callback) {
    this.assertEqual(value, this.response.headers[name.toLowerCase()])
    process.nextTick(callback)
  },
  
  check_body: function(expectedBody, callback) {
    var actualBody = this.response.body.replace(/^\s*|\s*$/g, '')
    if (typeof expectedBody === "string")
      this.assertEqual(expectedBody, actualBody)
    else
      this.assertMatch(expectedBody, actualBody)
    process.nextTick(callback)
  }
})

