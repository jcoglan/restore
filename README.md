# this is a fork of [gh:jcoglan/restore](https://github.com/jcoglan/restore)

I'm personally using this with Docker, to run my remoteStorage API on michielbdejong.com:

````
    git clone https://github.com/michielbdejong/restore.git
    docker build -t restore restore/
    docker run -d --volumes-from michiel-data -p 8000:8000 restore
````   

This uses the [remotestorage-server](http://npmjs.org/package/remotestorage-server) npm package, and an adapted version of the FileTree storage. Really what it mainly borrows from jcoglan's original reStore server is the OAuth dialog, and the code structure. There is a [pull-request](https://github.com/jcoglan/restore/pull/13) for this fork from February 2014, but since there has not been a lot of action on that, maybe it's better if I rename this server to something else, to avoid confusion around the cumbersome name "my personal fork of reStore".


## License

(The MIT License)

Copyright (c) 2012-2013 James Coglan

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the 'Software'), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

