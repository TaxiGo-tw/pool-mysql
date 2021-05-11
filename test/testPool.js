const { should } = require('chai')
should()
const assert = require('assert')

const pool = require('../model/Pool')

const options = require('../model/DefaultOptions')
options.writer.host = process.env.HOST2
options.writer.database = process.env.DB2
options.reader.host = process.env.HOST2
options.reader.database = process.env.DB2

const pool2 = pool.createPool({ options })

describe('test pool2', async () => {
	it('should finish a query', async () => {
		const connection = await pool2.createConnection()

		const [obj] = await connection.q('select * from town limit 1')
		connection.release()

		obj.should.have.property('id')
	})
})
