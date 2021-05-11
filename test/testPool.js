const { should } = require('chai')
should()
const assert = require('assert')

const pool = require('../model/Pool')

const options = require('../model/Options')({
	writer: {
		host: process.env.HOST2,
		database: process.env.DB2
	},
	reader: {
		host: process.env.HOST2,
		database: process.env.DB2
	}
})

const pool2 = pool.createPool({ options })

describe('test pool2', async () => {
	it('should finish a query', async () => {
		const connection = await pool2.createConnection()

		const [obj] = await connection.q('select * from town limit 1')
		connection.release()

		obj.should.have.property('id')
	})
})
