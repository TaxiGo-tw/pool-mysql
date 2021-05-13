const { should, expect, assert } = require('chai')  // Using Assert style
should()

const pool = require('../index')

const ZZZPoolMysqlTesting = require('./model/zzz_pool_mysql_testing')

describe('test Encryption', async () => {

	let connection

	it('before', async () => {
		connection = await pool.createConnection()
		await connection.awaitTransaction()
	})

	it('should decrypt back', async () => {
		const Encryption = require('../model/Encryption')
		const string = 'abc'

		const encrypted = Encryption.encrypt(string)
		const decrypted = Encryption.decrypt(encrypted)

		assert.strictEqual(decrypted, string)
	})

	it('should encrypt with Schema', async () => {
		const result = await ZZZPoolMysqlTesting
			.INSERT()
			.INTO()
			.SET('email = ?', 'test@g.com', { encryption: ['email'] })
			.PRINT()
			.exec()

		result.affectedRows.should.equal(1)
	})

	it('after', () => {
		connection.rollback()
		connection.release()
	})
})
