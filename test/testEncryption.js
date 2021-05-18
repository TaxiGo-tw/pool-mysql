const { should, expect, assert } = require('chai')  // Using Assert style
should()

const pool = require('../src/Pool')
const ZZZPoolMysqlTesting = require('./testModels/zzz_pool_mysql_testing')

describe('test Encryption', async () => {
	it('should decrypt back', async () => {
		const Encryption = require('../src/Schema/Encryption')
		const string = 'abc'


		const key = pool.options.DATA_ENCRYPTION_KEY
		const iv = pool.options.DATA_ENCRYPTION_IV


		const encrypted = Encryption.encrypt(string, { key, iv })
		const decrypted = Encryption.decrypt(encrypted, { key, iv })

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
