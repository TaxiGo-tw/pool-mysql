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

		let sql = 'ker ker'
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

describe('test connection end', () => {
	it('end', async () => {

		const c = await pool.createConnection()
		await c.q('select 1')

		const readerPool = pool._mysqlConnectionManager._readerPool

		const waitingA = readerPool._waitingCount
		const usingA = readerPool._usingCount

		c.end()

		const waitingB = readerPool._waitingCount
		const usingB = readerPool._usingCount

		assert.strictEqual(waitingA, waitingB)
		assert.strictEqual(usingA, usingB + 1)
	})
})

describe('connection status', () => {
	it('will reset', async () => {
		const connection = pool.connection()

		const s = JSON.parse(JSON.stringify(connection._status))
		connection.print
		const s2 = JSON.parse(JSON.stringify(connection._status))
		await connection.q('select 1')
		const s3 = JSON.parse(JSON.stringify(connection._status))

		s.should.not.deep.equal(s2)
		s.should.deep.equal(s3)

		connection.release()
	})

	it('test query mode', () => {
		const connection = pool.connection()

		assert.deepStrictEqual(connection._queryMode(), { Normal: true })

		assert.deepStrictEqual(connection._queryMode({ combine: true, queryKey: '123' }), { CombineLeader: true })

		connection._pool.combine.bind('123')
		assert.deepStrictEqual(connection._queryMode({ combine: true, queryKey: '123' }), { CombineSubscriber: true })
		connection._pool.combine.publish('123')

		assert.deepStrictEqual(connection._queryMode({ combine: true, queryKey: '123' }), { CombineLeader: true })

		if (pool.redisClient) {
			assert.deepStrictEqual(connection._queryMode({ EX: 1 }), { Caching: true })
		} else {// 測試環境可能無redis client
			assert.deepStrictEqual(connection._queryMode({ EX: 1 }), { Normal: true })
		}
	})
})

// 先拿掉, 有問題再說
// describe('test same time query', async () => {
// 	it('1', async () => {
// 		const connection = pool.connection()

// 		const q1 = 'select 1'
// 		const q2 = 'select 2'
// 		try {
// 			let a = connection.q(q1)
// 			let b = connection.q(q2)
// 			a = await a
// 			b = await b

// 			assert.fail('should catch, not finish')
// 		} catch (error) {
// 			error.message.should.include(`is querying in the same time with "${q1}" and "${q2}"`)
// 		} finally {
// 			connection.release()
// 		}
// 	})
// })

describe('test get connection', () => {
	it('1', (done) => {
		pool.getConnection((_, connection) => {
			connection.release()
			done()
		})
	})

	it('2', async () => {
		for (let i = 0; i < 10000; i++) {
			const connection = await pool.createConnection()
			connection.release()
		}
	})
})

describe('test pool.query()', () => {
	it('1', (done) => {
		pool.query('SELECT * FROM trips LIMIT 5', (err, r) => {
			assert(!err)
			r.length.should.equal(5)
			done()
		})
	})

	it('2', (done) => {
		pool.query('SELECT * FROM trips LIMIT ?', 5, (err, r) => {
			assert(!err)
			r.length.should.equal(5)
			done()
		})
	})
})


describe('test connection.query()', () => {
	it('3', (done) => {
		const connection = pool.connection()

		connection.query('SELECT * FROM trips LIMIT 5', (_, r) => {
			connection.release()
			done()
		})
	})
})

describe('test connection reset _status.mustUpdateOneRow after mustUpdateOneRow error', () => {
	it('1', (done) => {
		const connection = pool.connection()

		const sql = `UPDATE trips SET user_id = 101 WHERE user_id = 101 LIMIT 3;`
		connection.mustUpdateOneRow.query(sql, (err, result) => {
			assert(err.message.includes('MUST_UPDATE_ONE_ROW'))
			assert(connection._status.mustUpdateOneRow === false)
			connection.release()
			done()
		})

	})
})
