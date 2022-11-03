const { should, expect } = require('chai')
should()
const assert = require('assert')

const pool = require('../src/Pool')

const options = {
	writer: {
		host: process.env.HOST2,
		database: process.env.DB2
	},
	reader: {
		host: process.env.HOST2,
		database: process.env.DB2
	},
	forceWriter: true
}

const pool2 = pool.createPool({ options })
const pool3 = pool.createPool({ options })

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


	it('test pool id', () => {
		assert.strictEqual(pool.id, 1)
		assert.strictEqual(pool2.id, 2)
		assert.strictEqual(pool3.id, 2)
	})

	it('test createPool, should be same object', () => {
		assert.notDeepStrictEqual(pool, pool2)
		assert.deepStrictEqual(pool2, pool3)
	})

	it('test schema for pool2', async () => {
		const ZZZPoolMysqlTesting = require('./testModels/zzz_pool_mysql_testing')

		const connection = pool2.connection()

		const obj = await ZZZPoolMysqlTesting.SELECT('*').FROM().FIRST().EX(5).exec(connection)

		expect(obj).to.have.property('id')
		expect(obj).to.not.have.property('email')

		connection.should.have.property('writer')

		connection.release()
	})
})
