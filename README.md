# reStore [![Build Status](https://secure.travis-ci.org/jcoglan/restore.svg)](http://travis-ci.org/jcoglan/restore)

### CAVEAT EMPTOR

Although it may have been published to the `npm` repo, this project is still
considered experimental. It has not been widely deployed, and I am in the
process of rolling it out for personal use and within my company.

As with any alpha-stage storage technology, you MUST expect that it will eat
your data and take precautions against this. You SHOULD expect that its APIs and
storage schemas will change before it is labelled stable. I MAY respond to bug
reports but you MUST NOT expect that I will.

Per the MIT license, **usage is entirely at your own risk**.

## What is this?

reStore [RemoteStorage][1] server written for Node.js. It is designed to be
compatible with [RemoteStorage.js][2] from version 0.6 onwards, covering
versions [RemoteStorage-2011.10][3], [RemoteStorage-2012.04][4], and
[draft-dejong][5] of the protocol.

[1]: http://www.w3.org/community/unhosted/wiki/RemoteStorage
[2]: http://remotestorage.io/
[3]: http://www.w3.org/community/unhosted/wiki/RemoteStorage-2011.10
[4]: http://www.w3.org/community/unhosted/wiki/RemoteStorage-2012.04
[5]: http://tools.ietf.org/id/draft-dejong-remotestorage.txt


## Installation

```
$ npm install restore
```


## Usage

The following Node script will run a basic server:

```js
process.umask(077);

var reStore = require('restore'),
    store   = new reStore.FileTree({path: 'path/to/storage'}),
    
    server  = new reStore({
                store:  store,
                http:   {host: '127.0.0.1', port: 8000}
              });

server.boot();
```

The `host` option is optional and specifies the hostname the server will listen
on. Its default value is `0.0.0.0`, meaning it will listen on all interfaces.

The server does not allow users to sign up, out of the box. If you need to allow
that, use the `allow.signup` option:

```js
var server = new reStore({
               store: store,
               http:  {host: '127.0.0.1', port: 8000},
               allow: {signup: true}
             });
```

If you navigate to `http://localhost:8000/` you should then see a sign-up link
in the navigation.


### Storage security

In production, we recommend that you restrict access to the files managed by
your reStore server as much as possible. This is particularly true if you host
your storage on a machine with other web applications; you need to protect your
files in the event that one of those apps is exploited.

You should take these steps to keep your storage safe:

* Pick a unique Unix user to run your server process; no other process on the
  box should run as this user
* Do not run other applications as root, or as any user that could access files
  owned by your reStore user
* Use `process.umask(077)` as shown above so that the server creates files that
  can only be accessed by the process's owner
* Make sure the directory `path/to/storage` cannot be read, written or executed
  by anyone but this user
* Do not run reStore as root; if you need to bind to port 80 or 443 use a
  reverse proxy like Apache or nginx
* Ideally, run your storage inside a container or on a dedicated machine

If you're using the Redis backend, apply similar access restrictions to the
database and to any files containing the database access credentials.


### Serving over HTTPS

Since RemoteStorage is a system for storing arbitrary user-specific data, and
since it makes use of OAuth 2.0, we recommend you serve it over a secure
connection. You can boot the server to listen for HTTP or HTTPS requests or
both. This configuration boots the app on two ports, one secure and one
plaintext:

```js
var server = new reStore({
  store:  store,
  http:   {
    host: '127.0.0.1',
    port: 8000
  },
  https:  {
    force:  true,
    host:   '127.0.0.1',
    port:   4343,
    key:    'path/to/ssl.key',
    cert:   'path/to/ssl.crt',
    ca:     'path/to/ca.pem'    // optional
  }
});

server.boot();
```

Note that you should not run reStore as root. To make it available via port 80
or 443, use Apache, nginx or another reverse proxy.

The `force: true` line in the `https` section means the app will:

* Return HTTPS URLs in WebFinger responses
* Force sign-up and OAuth login pages onto an HTTPS connection
* Refuse to process POST authentication requests over insecure connections
* Block insecure storage requests and revoke the client's access

reStore considers a request to be secure if:

* reStore itself acts as an SSL terminator and the connection to it is
  encrypted
* The `X-Forwarded-SSL` header has the value `on`
* The `X-Forwarded-Proto` header has the value `https`
* The `X-Forwarded-Scheme` header has the value `https`

So you can have an SSL-terminating proxy in front of reStore as long as it sets
one of those headers, and *does not* let external clients set them. In this
setup, you can set `https.force = true` but omit `https.port`; this means
reStore itself will not accept encrypted connections but will apply the above
behaviour to enforce secure connections.


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
                store:  store,
                http:   {port: process.argv[2]}
              });

server.boot();
```


## License

(The MIT License)

Copyright (c) 2012-2015 James Coglan

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the 'Software'), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
