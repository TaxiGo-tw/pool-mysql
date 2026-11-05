const assert = require('assert')

const pool = require('../src/Pool')

const base = {
	writer: { host: '10.0.0.1', port: 3306, user: 'app', password: 'secret-a', database: 'db_a' },
	reader: { host: '10.0.0.2', port: 3306, user: 'app', password: 'secret-a', database: 'db_a' },
	forceWriter: false
}

const variant = ({ writer, reader, forceWriter } = {}) => Object.assign({}, base, {
	writer: Object.assign({}, base.writer, writer),
	reader: Object.assign({}, base.reader, reader),
	forceWriter: forceWriter === undefined ? base.forceWriter : forceWriter
})

const fakeRedis = () => ({ getAsync: async () => null, setAsync: async () => 'OK' })

describe('createPool identity', () => {
	it('same config returns the same pool and connection manager', () => {
		const a = pool.createPool({ options: base })
		const b = pool.createPool({ options: variant() })

		assert.strictEqual(a, b)
		assert.strictEqual(a._mysqlConnectionManager, b._mysqlConnectionManager)
	})

	it('same hosts but different database get different pools', () => {
		const a = pool.createPool({ options: base })
		const b = pool.createPool({ options: variant({ writer: { database: 'db_b' }, reader: { database: 'db_b' } }) })

		assert.notStrictEqual(a, b)
		assert.notStrictEqual(a._mysqlConnectionManager, b._mysqlConnectionManager)
		assert.strictEqual(b.options.writer.database, 'db_b')
	})

	it('same writer but different reader database get different pools', () => {
		const a = pool.createPool({ options: base })
		const b = pool.createPool({ options: variant({ reader: { database: 'db_b' } }) })

		assert.notStrictEqual(a, b)
	})

	it('same hosts but different user get different pools', () => {
		const a = pool.createPool({ options: base })
		const b = pool.createPool({ options: variant({ writer: { user: 'other' }, reader: { user: 'other' } }) })

		assert.notStrictEqual(a, b)
		assert.strictEqual(b.options.writer.user, 'other')
	})

	it('same hosts but different password get different pools', () => {
		const a = pool.createPool({ options: base })
		const b = pool.createPool({ options: variant({ writer: { password: 'secret-b' }, reader: { password: 'secret-b' } }) })

		assert.notStrictEqual(a, b)
	})

	it('same hosts but different port get different pools', () => {
		const a = pool.createPool({ options: base })
		const b = pool.createPool({ options: variant({ writer: { port: 3307 }, reader: { port: 3307 } }) })

		assert.notStrictEqual(a, b)
	})

	it('different forceWriter get different pools', () => {
		const a = pool.createPool({ options: base })
		const b = pool.createPool({ options: variant({ forceWriter: true }) })

		assert.notStrictEqual(a, b)
	})

	it('same config with different redisClient objects get different pools, same object reuses', () => {
		const redisA = fakeRedis()
		const redisB = fakeRedis()

		const a = pool.createPool({ options: base, redisClient: redisA })
		const b = pool.createPool({ options: variant(), redisClient: redisB })
		const c = pool.createPool({ options: variant(), redisClient: redisA })
		const none = pool.createPool({ options: base })

		assert.notStrictEqual(a, b)
		assert.strictEqual(a, c)
		assert.notStrictEqual(a, none)
		assert.strictEqual(a.redisClient, redisA)
		assert.strictEqual(b.redisClient, redisB)
	})

	it('pool keys do not contain plaintext passwords', () => {
		const keys = Object.keys(pool._pools)

		assert.ok(keys.length > 0)
		assert.ok(keys.every(key => !key.includes('secret-a') && !key.includes('secret-b')))
	})
})
