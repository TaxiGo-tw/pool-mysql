const crypto = require('crypto')
const algorithm = 'aes-256-cbc'

module.exports = class Encryption {

	static buffered({ key, iv }) {
		return {
			key: Buffer.from(key, 'hex'),
			iv: Buffer.from(iv, 'hex')
		}
	}

	static encrypt(text, secret) {
		try {
			const { key, iv } = Encryption.buffered(secret)

			const cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv)
			let encrypted = cipher.update(text)
			encrypted = Buffer.concat([encrypted, cipher.final()])
			return encrypted.toString('hex')
		} catch (e) {
			return ''
		}
	}

	static decrypt(text, secret) {
		try {
			const { key, iv } = Encryption.buffered(secret)

			const encryptedText = Buffer.from(text, 'hex')
			const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), iv)
			let decrypted = decipher.update(encryptedText, 'binary')
			decrypted = Buffer.concat([decrypted, decipher.final()])
			return decrypted.toString()
		} catch (e) {
			return ''
		}
	}
}
