const { should, expect, assert } = require('chai')  // Using Assert style
should()

const pool = require('../index')
const ZZZPoolMysqlTesting = require('./model/zzz_pool_mysql_testing')

describe('test Encryption', async () => {
	it('should decrypt back', async () => {
		const Encryption = require('../model/Encryption')
		const string = 'abc'

		const encrypted = Encryption.encrypt(string)
		const decrypted = Encryption.decrypt(encrypted)

		assert.strictEqual(decrypted, string)
	})

	it('should encrypt with Schema', async () => {
		const connection = await pool.createConnection()
		await connection.awaitTransaction()

		const email = 'test@g.com'

		const result = await ZZZPoolMysqlTesting
			.INSERT()
			.INTO()
			.SET({ email }, undefined, { encryption: ['email'] })
			.exec(connection)

		result.affectedRows.should.equal(1)

		const id = result.insertId

		const [obj] = await ZZZPoolMysqlTesting.SELECT().FROM().WHERE({ id }).WRITER().exec(connection)
		obj.id.should.equal(id)
		obj.email.should.not.equal(email)

		const [obj2] = await ZZZPoolMysqlTesting.SELECT().FROM().WHERE({ id }).DECRYPT('email').WRITER().exec(connection)
		obj2.id.should.equal(id)
		obj2.email.should.equal(email)

		await connection.rollback()
		connection.release()
	})
})
