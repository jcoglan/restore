process.env.SILENT = '1'

require('jsclass')
JS.require('JS.Test')

require('./restore/web_finger_spec')
require('./restore/oauth_spec')
require('./restore/storage_spec')

JS.Test.autorun()

