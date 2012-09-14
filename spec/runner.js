process.env.SILENT = '1'

require('jsclass')
JS.require('JS.Test')

require('./restore/web_finger_spec')
require('./restore/oauth_spec')
require('./restore/storage_spec')

require('./store_spec.js')
require('./stores/file_spec')
require('./stores/redis_spec')

JS.Test.autorun()

