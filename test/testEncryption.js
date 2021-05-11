const { should } = require('chai')  // Using Assert style
should()  // Modifies `Object.prototype`
const assert = require('assert')

const Encryption = require('../model/Encryption')


describe('test Encrypt', async () => {

	it('should decrypt back', () => {
		const string = 'abc'

		const encrypted = Encryption.encrypt(string)
		const decrypted = Encryption.decrypt(encrypted)

		assert.strictEqual(decrypted, string)
	})
})
