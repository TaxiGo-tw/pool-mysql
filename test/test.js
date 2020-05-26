require('dotenv').config({ path: '.env' })
process.env.NODE_ENV = 'TESTING'

require('./testScheme')
require('./testValidations')
