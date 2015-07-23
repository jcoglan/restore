# Notes

## Protocol versions

### [RemoteStorage-2011.10](https://www.w3.org/community/unhosted/wiki/RemoteStorage-2011.10)

WebFinger format:

    <Link rel="remoteStorage" template="$TEMPLATE" api="$API" auth="$AUTH"></Link>

* `$TEMPLATE` -  a template for the web address (URL) of the storage, containing
  the string `{category}`
* `$API` - which exact HTTP API is exposed
* `$AUTH` - the OAuth end-point for obtaining `$TOKEN`
* `$CATEGORY` - a string that corresponds to one independent key-value store,
  e.g. 'contacts'
* `$TOKEN` - the bearer token given out by the OAuth dialog

Scope format: `scope={category}`

### [RemoteStorage-2012.04](https://www.w3.org/community/unhosted/wiki/RemoteStorage-2012.04)

WebFinger format:

    GET /.well-known/host-meta?resource=acct:bob@example.com

    HTTP/1.1 200 OK
    access-control-allow-origin: *
    content-type: application/json

    {
      links:[{
        href: 'https://example.com/storage/bob',
        rel: "remoteStorage",
        type: "https://www.w3.org/community/rww/wiki/read-write-web-00#simple",
        properties: {
          'auth-method': "https://tools.ietf.org/html/draft-ietf-oauth-v2-26#section-4.2",
          'auth-endpoint': 'https://example.com/auth/bob
        }
      }]
    }

Scope format: `scope={category}:rw` or `scope={category}:r`

`GET` for a document returns `Content-Type`, `Last-Modified` and content with
`200` if present, `404` if absent.

`GET` for a folder returns a name->timestamp map:

    Access-Control-Allow-Origin: *
    Content-Type: application/json
    Last-Modified: Sat Feb 14 2009 06:21:28 GMT+0100 (CET)
              
    {
      "bla": 1234544444,
      "bar/": 12345888888
    }

`GET` for a non-existing folder returns `{}` with `200`.

`PUT` to a document returns the `Last-Modified` for the timestamp recorded by
the server.

Response codes:

* `401` or `403` as required by OAuth
* `200` for existing documents
* `404` for non-existing documents

All responses to contain `Access-Control-Allow-Origin: *`.

### [draft-dejong-remotestorage-00](https://tools.ietf.org/html/draft-dejong-remotestorage-00)

WebFinger format:

    {
      href: <storage_root>,
      rel: "remotestorage",
      type: "draft-dejong-remotestorage-00",
      properties: {
        'auth-method': "http://tools.ietf.org/html/rfc6749#section-4.2",
        'auth-endpoint': <auth_endpoint>
      }
    }

Scope format: `root:rw`, `root:r`, `<module>:rw`, `<module>:r`

Item names may contain `a-z`, `A-Z`, `0-9`, `%`, `-`, `_` (not `.`).

Access tokens should be passed as a header, as in

    Authorization: Bearer <access_token>

`GET` for a folder returns a name->version map as `application/json`:

    Content-Type: application/json

    {
      "abc": 1234567890123,
      "def/": 1234567890456
    }

`GET` for a non-existing folder returns a `404`.

`GET` for a document returns `Content-Type`, `ETag`, and content with `200` if
present, `404` if absent.

`PUT` to a document returns the new `ETag`.

Versions/ETags are timestamps recorded by the server, as Unix time in
milliseconds.

Response codes:

* `200`: successful `GET`, `PUT` and `DELETE`
* `304`: `GET` where precondition fails
* `401`: tokens with insufficient permissions
* `404`: `GET` or `DELETE` to non-existing documents
* `409`: `PUT` or `DELTE` where precondition fails
* `420`: client violates rate limit or behaves maliciously
* `500`: internal server error

All responses should contain `ETag`; the current one for `GET`, the new one for
`PUT`, the deleted one for `DELETE`.

`PUT` and `DELETE` use `If-Unmodified-Since` and `GET` uses `If-Modified-Since`
for preconditions.

### [draft-dejong-remotestorage-01](https://tools.ietf.org/html/draft-dejong-remotestorage-01)

WebFinger format:

    {
      href: <storage_root>,
      rel: "remotestorage",
      type: "draft-dejong-remotestorage-01",
      properties: {
        "http://tools.ietf.org/html/rfc6749#section-4.2": <auth-dialog>
      }
    }

Item names may contain `a-z`, `A-Z`, `0-9`, `%`, `.`, `-`, `_`, and must not
have zero length.

`GET` for a folder returns a name->version map as `application/json`:

    Content-Type: application/json

    {
      "abc": "DEADBEEFDEADBEEFDEADBEEF",
      "def/": "1337ABCD1337ABCD1337ABCD"
    }

Versions/ETags can be anything but a hash of the document contents is suggested.

Response codes:

* `200`: successful `GET`, `PUT` and `DELETE`
* `401`: tokens with insufficient permissions
* `404`: `GET` or `DELETE` to non-existing documents
* `412`: `GET`, `PUT` or `DELTE` where precondition fails
* `420`: client violates rate limit or behaves maliciously
* `500`: internal server error
* `507`: user exceeds storage quota

`PUT` and `DELETE` use `If-Match` and `GET` uses `If-None-Match` for
preconditions. `PUT` may have `If-None-Match: *` which should succeed if the
document does not exist.

### [draft-dejong-remotestorage-02](https://tools.ietf.org/html/draft-dejong-remotestorage-02)

WebFinger format:

    {
      "href": <storage_root>,
      "rel": "remotestorage",
      "properties": {
        "http://remotestorage.io/spec/version": "draft-dejong-remotestorage-02",
        "http://tools.ietf.org/html/rfc6749#section-4.2": <auth-dialog>,
        "http://tools.ietf.org/html/rfc6750#section-2.3": <query-param>,
        "https://tools.ietf.org/html/rfc2616#section-14.16": <ranges>
      }
    }

`<query-param>` is `true` if the server supports passing access tokens via the
`access_token` query parameter rather than as a header. `<ranges>` is `"GET"` if
the server supports `Range` on `GET` requests and `false` otherwise. ([RFC
6749](https://tools.ietf.org/html/rfc6749) is OAuth 2.0, [RFC
6750](https://tools.ietf.org/html/rfc6750) is Bearer tokens, and [RFC
2616](https://tools.ietf.org/html/rfc2616) is HTTP.)

Scope format: `*:rw`, `*:r`, `<module>:rw`, `<module>:r`

Access tokens may also appear via the `access_token` parameter if the server's
WebFinger response indicates so.

A *document description* is its `ETag`, `Content-Type` and `Content-Length`
fields. A *folder description* is its `ETag` field.

`GET` for a folder returns a name->description map as `application/json`:

    Content-Type: application/json

    {
      "@context": "http://remotestorage.io/spec/folder-description",
      "items": {
        "abc": {
          "ETag": "DEADBEEFDEADBEEFDEADBEEF",
          "Content-Type": "image/jpeg",
          "Content-Length": 82352
        },
        "def/": {
          "ETag": "1337ABCD1337ABCD1337ABCD"
        }
      }
    }

`GET` for a non-existing folder returns either a `404` or `{}` with a `200`.

`GET` for a document returns `Content-Length`, as well as `Content-Type`,
`ETag`, and content with `200` if present, `404` if absent. The server may
support `Content-Range`.

Servers should support chunked encoding on `PUT`.

`HEAD` is like `GET` but with no response body; `Content-Length` should still be
included.

Response codes:

* `2xx`: successful request, e.g. `201` when `PUT` creates a document
* `304`: `GET` where precondition fails
* `4xx`: malformed request
* `401`: tokens with insufficient permissions
* `404`: `GET` or `DELETE` to non-existing documents
* `409`: `PUT` where a folder name conflicts with a document name or vice versa
* `412`: `PUT` or `DELTE` where precondition fails
* `414`: request URI is too long
* `416`: invalid `Range`
* `429`: client violates rate limit or behaves maliciously
* `500`: internal server error
* `507`: user exceeds storage quota

All responses must contain `ETag` and `Expires: 0`. All ETag values must be in
double-quotes.

`GET` may include a comma-separated list in `If-None-Match`.

### [draft-dejong-remotestorage-03](https://tools.ietf.org/html/draft-dejong-remotestorage-03)

WebFinger format:

    {
      "href": <storage_root>,
      "rel": "remotestorage",
      "properties": {
        "http://remotestorage.io/spec/version": "draft-dejong-remotestorage-03",
        "http://tools.ietf.org/html/rfc6749#section-4.2": <auth-dialog>,
        "http://tools.ietf.org/html/rfc6750#section-2.3": <query-param>,
        "https://tools.ietf.org/html/rfc2616#section-14.16": <ranges>
      }
    }

`<auth-dialog>` is either `false` or the URI of the auth page. Clients that
cannot obtain access tokens should use
[Kerberos](https://tools.ietf.org/html/rfc4120).

The server may expire access tokens (previously they should not have done this).

`GET` for a folder returns a name->description map as `application/ld+json`.

`GET` for a non-existing folder returns `{}` with a `200`.

### [draft-dejong-remotestorage-04](https://tools.ietf.org/html/draft-dejong-remotestorage-04)

WebFinger format:

    Content-Type: application/jrd+json

    {
      "href": <storage_root>,
      "rel": "remotestorage",
      "properties": {
        "http://remotestorage.io/spec/version": "draft-dejong-remotestorage-04",
        "http://tools.ietf.org/html/rfc6749#section-4.2": <auth-dialog>,
        <optional-fields>
      }
    }

`<auth-dialog>` should be `null` (not `false`) or a URI.

Optional fields:

    "http://tools.ietf.org/html/rfc6750#section-2.3": <query-param>

`<query-param>` should have be `"true"`, not `true`, if the server supports the
`access_token` param.

    "http://tools.ietf.org/html/rfc7233": <ranges>

`<ranges>` should be `"GET"`, `"PUT"` or `"GET,PUT"` depending on which requests
the server supports `Content-Range` on, or `false`.

    "http://remotestorage.io/spec/web-authoring": <authoring-domain>

`<authoring-domain>` is the domain published to if the server supports web
authoring.

`Expires: 0` is only required on successful `GET`.

### [draft-dejong-remotestorage-05](https://tools.ietf.org/html/draft-dejong-remotestorage-05)

WebFinger format:

    Content-Type: application/jrd+json

    {
      "href": <storage_root>,
      "rel": "http://tools.ietf.org/id/draft-dejong-remotestorage",
      "properties": {
        "http://remotestorage.io/spec/version": "draft-dejong-remotestorage-05",
        "http://tools.ietf.org/html/rfc6749#section-4.2": <auth-dialog>,
        <optional-fields>
      }
    }
