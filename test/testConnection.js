const { should } = require('chai')  // Using Assert style
should()  // Modifies `Object.prototype`
const assert = require('assert')

const pool = require('../src/Pool')


describe('test data mock', async () => {
	before(() => {
		pool.mock = (index, sql) => {
			return [
				{ 'a': 1, sql },
				{ 'a': 2, sql },
				{ 'a': 3, sql },
				{ 'a': 4, sql },
			][index]
		}
	})

	it('test1', async () => {
		const connection = await pool.createConnection()

		let sql = 'kerker'
		let mocked = await connection.q(sql)
		mocked['a'].should.equal(1)
		mocked['sql'].should.equal(sql)

		sql = 'abc'
		mocked = await connection.q(sql)
		mocked['a'].should.equal(2)
		mocked['sql'].should.equal(sql)

		sql = 'SELECT * FROM .... '
		mocked = await connection.q(sql)
		mocked['a'].should.equal(3)
		mocked['sql'].should.equal(sql)

		connection.release()
	})

	after(() => {
		pool.mock = undefined
	})
})
