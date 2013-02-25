# reStore [![Build Status](https://secure.travis-ci.org/jcoglan/restore.png)](http://travis-ci.org/jcoglan/restore)

### CAVEAT EMPTOR

Although it may have been published to the `npm` repo, this project is still
considered experimental. It has not been widely deployed, and I am in the
process of rolling it out for personal use and within my company.

As with any alpha-stage storage technology, you MUST expect that it will eat
your data and take precautions against this. You SHOULD expect that its APIs
and storage schemas will change before it is labelled stable. I MAY respond to
bug reports but you MUST NOT expect that I will.

Per the MIT license, **usage is entirely at your own risk**.

## What is this?

reStore [remoteStorage][1] server written for Node.js. It is designed to be
compatible with the 0.6 ([RemoteStorage-2011.10][2]) and 0.7
([RemoteStorage-2012.04][3], [draft-dejong-00][4]) versions of
[remoteStorage.js][5].

[1]: http://www.w3.org/community/unhosted/wiki/RemoteStorage
[2]: http://www.w3.org/community/unhosted/wiki/RemoteStorage-2011.10
[3]: http://www.w3.org/community/unhosted/wiki/RemoteStorage-2012.04
[4]: http://tools.ietf.org/id/draft-dejong-remotestorage-00.txt
[5]: http://remotestorage.io/


## Usage

Make a Node script to set up the server:

```js
// server.js

var reStore = require('restore'),
    store   = new reStore.FileTree({path: 'path/to/storage'}),
    
    server  = new reStore({
                store:  store
                http:   {port: process.argv[2]}
              });

server.boot();
```

Boot the server on port 80:

    sudo node server.js 80

### Storage backends

reStore supports pluggable storage backends, and comes with two implementations
out of the box:

* `reStore.FileTree` - Uses the filesystem hierarchy and stores each item in its
  own individual file. Content and metadata are stored in separate files so the
  content does not need base64-encoding and can be hand-edited. Must only be run
  using a single server process.
* `reStore.Redis` - Stores data in a Redis database, and all stored data is
  base64-encoded. It can be run with any number of server processes.

All the backends support the same set of features, including the ability to
store arbitrary binary data with content types and modification times.

They are configured as follows:

```js
// To use the file tree store:
var store = new reStore.FileTree({path: 'path/to/storage'});

// To use the Redis store:
var store = new reStore.Redis({
  host:     'redis.example.com',    // default is 'localhost'
  port:     1234,                   // default is 6379
  database: 2,                      // default is 0
  password: 'unhosted'              // default is no password
});

// Then create the server with your store:
var server = new reStore({
               store:  store
               http:   {port: process.argv[2]}
             });

server.boot();
```

### Serving over HTTPS

Since remoteStorage is a system for storing arbitrary user-specific data, and
since it makes use of OAuth 2.0, we recommend you serve it over a secure
connection. You can boot the server to listen for HTTP or HTTPS requests or
both. This configuration boots the app on two ports, one secure and one
plaintext:

```js
var server = new reStore({
  store:  store,
  http:   {port: 80},
  https:  {
    force:  true,
    port:   443,
    key:    'path/to/ssl.key',
    cert:   'path/to/ssl.crt'
  }
});

server.boot();
```

The `force: true` line in the `https` section means the app will:

* Return HTTPS URLs in WebFinger responses
* Force sign-up and OAuth login pages onto an HTTPS connection
* Refuse to process POST authentication requests over insecure connections
* Block insecure storage requests and revoke the client's access

reStore considers the following requests to be secure:

* reStore itself acts as an SSL terminator and the connection to it is encrypted
* The `X-Forwarded-SSL` header has the value `on`
* The `X-Forwarded-Proto` header has the value `https`
* The `X-Forwarded-Scheme` header has the value `https`

So you can have an SSL-terminating proxy in front of reStore as long as it sets
one of those headers, and *does not* let external clients set them. In this
setup, you can set `https.force = true` but not set `https.port`; this means
reStore itself will not accept encrypted connections but will apply the above
behaviour to enforce secure connections.


## Running the examples

This repository contains examples using the `stable` and `master` branches of
remoteStorage.js. You'll need to bind `127.0.0.1` to the host `local.dev` for
the demo to work correctly.

Run the example server:

    sudo node example/server.js

Create a user:

    curl -kX POST https://local.dev/users -d 'username=me' -d 'password=foo'

Serve the example app using Python:

    cd example
    python -m SimpleHTTPServer

And open the example apps for each version. You may need to dismiss browser
warnings about the self-signed certificate for `local.dev` before the clients
will connect properly.

    open http://local.dev:8000/rs-stable.html
    open http://local.dev:8000/rs-master.html


## License

(The MIT License)

Copyright (c) 2012-2013 James Coglan

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

