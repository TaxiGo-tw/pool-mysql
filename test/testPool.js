const { should } = require('chai')
should()
const assert = require('assert')

const pool = require('../src/Pool')

const options = require('../src/Options')({
	writer: {
		host: process.env.HOST2,
		database: process.env.DB2
	},
	reader: {
		host: process.env.HOST2,
		database: process.env.DB2
	},
	forceWriter: true
})

const pool2 = pool.createPool({ options })

describe('test pool2', async () => {
	it('should finish a query', async () => {
		const connection = await pool2.createConnection()

		const [obj] = await connection.q('select * from town limit 1')


		connection.should.have.property('writer')
		connection.should.not.have.property('reader')

		connection.release()

		connection.should.not.have.property('writer')
		connection.should.not.have.property('reader')

		obj.should.have.property('id')
	})
})
