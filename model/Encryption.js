const crypto = require('crypto')
const algorithm = 'aes-256-cbc'

const key = Buffer.from(process.env.DATA_ENCRYPTION_KEY, 'hex')
const iv = Buffer.from(process.env.DATA_ENCRYPTION_IV, 'hex')

module.exports = class Encryption {

	static encrypt(text) {
		const cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv)
		let encrypted = cipher.update(text)
		encrypted = Buffer.concat([encrypted, cipher.final()])
		return encrypted.toString('hex')
	}

	static decrypt(text) {
		const encryptedText = Buffer.from(text, 'hex')
		const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), iv)
		let decrypted = decipher.update(encryptedText, 'binary')
		decrypted = Buffer.concat([decrypted, decipher.final()])
		return decrypted.toString()
	}
}
