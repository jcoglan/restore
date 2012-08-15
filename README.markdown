# reStore

This is a simple [remoteStorage](http://www.w3.org/community/unhosted/wiki/RemoteStorage)
server written in Node.js. It is still in the experimental stage, and currently
implements just enough to make the demo in `example/index.html` work, using the
standard remoteStorage client. YOU SHOULD NOT INSTALL IT ANYWHERE, THINGS ARE
GOING TO CHANGE.

It uses file-based storage, and is only safe to use at small scale using a
single server process. It is primarily designed for personal use, although it
has been built with swappable storage in mind so we can implement a Redis
backend for bigger installations.

It stores user passwords as salted PBKDF2 hashes. It does not store access
tokens at all; it issues self-contained tokens signed using HMAC-SHA256 with the
user's password.


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

You'll need to bind `127.0.0.1` to the host `local.dev` for the remoteStorage
demo to work correctly.

Create a user:

    curl -X POST local.dev/users -d 'username=me' -d 'password=foo'

Serve the example app using Python:

    cd example
    python -m SimpleHTTPServer

And open the example app:

    open http://local.dev:8000/


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

