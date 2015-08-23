### 0.3.0 / 2015-08-23

* Allow the HTTP/HTTPS listening hostname to be specified
* Support the `/.well-known/webfinger` endpoint with options extension
* Support `If-None-Match: *` on `PUT` requests
* Support passing OAuth tokens via the `access_token` parameter
* Return `ETag` header with double quotes
* Return` Access-Control-Expose-Headers` on `GET`/`PUT`/`DELETE`, not just `OPTIONS`
* Make all the write operations in the Redis backend atomic
* Fix bugs caused by `url.parse(string, true).query` being undefined
* Fix incompatibilities with EJS 2.0
* Fix errors arising from 'state' not being set when rendering OAuth page

### 0.2.0 / 2014-02-22

* Allow dots in pathnames, but block path traversal attempts
* Respond with `304` for conditional `GET` instead of `412`
* Only use `ETag`/`If-Match`/`If-None-Match` for versioning, not `Last-Modified`
* Add a `ca` option to the HTTPS config
* Storage engines now take versions as timestamps, not Dates
* User accounts now require an email address
* Change file naming to accommodate dots in names, automatically migrate old files
* Fix some locking problems in the filesystem backend
* Add nice HTML views for home page, sign-up form, error pages

### 0.1.0 / 2013-02-25

* Initial release with working protocol usable by clients
* Filesystem and Redis backends
