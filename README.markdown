# reStore [![Build Status](https://secure.travis-ci.org/jcoglan/restore.png)](http://travis-ci.org/jcoglan/restore)

This is a simple [remoteStorage][1] server written in Node.js. It is still in
the experimental stage, but is designed to be compatible with the 0.6
([RemoteStorage-2011.10][2]) and 0.7 ([RemoteStorage-2012.04][3]) versions of
[remoteStorage.js][4].

[1]: http://www.w3.org/community/unhosted/wiki/RemoteStorage
[2]: http://www.w3.org/community/unhosted/wiki/RemoteStorage-2011.10
[3]: http://www.w3.org/community/unhosted/wiki/RemoteStorage-2012.04
[4]: http://remotestoragejs.com/

YOU SHOULD NOT INSTALL IT ANYWHERE YET, THINGS ARE GOING TO CHANGE.


## Usage

Make a Node script to set up the server:

```js
// server.js

var reStore = require('restore'),
    store   = new reStore.File('path/to/storage'),
    server  = new reStore({store: store});

server.listen(process.argv[2]);
```

Boot the server on port 80:

    sudo node server.js 80

### Storage backends

reStore supports pluggable storage backends, and comes with three
implementations out of the box:

* `reStore.File` - stores each user's entire data set in a single JSON file on
  disk. Suitable for holding small amounts of data, and must only be run using
  a single server process
* `reStore.FileTree` - uses the filesystem hierarchy and stores each item in its
  own individual file, and must only be run using a single server process
* `reStore.Redis` - stores data in a Redis database, can be run with any number
  of server processes

They are configured as follows:

```js
// To use the file store:
var store = new reStore.File('path/to/storage');

// To use the file tree store:
var store = new reStore.FileTree('path/to/storage');

// To use the Redis store:
var store = new reStore.Redis({
  host:     'redis.example.com',    // default is 'localhost'
  port:     1234,                   // default is 6379
  database: 2,                      // default is 0
  password: 'unhosted'              // default is no password
});

// Then create the server with your store:
var server = new reStore({store: store});
server.listen(80);
```


## Running the examples

This repository contains examples using the `stable` and `master` branches of
remoteStorage.js. You'll need to bind `127.0.0.1` to the host `local.dev` for
the demo to work correctly.

Run the example server on port 80:

    sudo node example/server.js 80

Create a user:

    curl -X POST local.dev/users -d 'username=me' -d 'password=foo'

Serve the example app using Python:

    cd example
    python -m SimpleHTTPServer

And open the example apps for each version:

    open http://local.dev:8000/rs-stable.html
    open http://local.dev:8000/rs-master.html


## License

(The MIT License)

Copyright (c) 2012 James Coglan

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the 'Software'), to deal in
the Software without restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

