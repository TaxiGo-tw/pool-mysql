const crypto = require('crypto')
const algorithm = 'aes-256-cbc'
const aeadAlgorithm = 'aes-256-gcm'

// 新格式（AEAD）版本前綴。legacy CBC 輸出是純 hex，不會以 'v2:' 起頭，故可用來辨識格式。
const AEAD_PREFIX = 'v2:'
const AEAD_NONCE_LENGTH = 12
const AEAD_TAG_LENGTH = 16

//向下相容
const defaultSecret = {
	key: process.env.DATA_ENCRYPTION_KEY,
	iv: process.env.DATA_ENCRYPTION_IV
}

// 讀 flag（呼叫時才讀，部署後可直接切換而不需改碼）。
// 預設關＝維持寫入舊 CBC，merge 後執行時零改變；開＝改寫 AES-256-GCM。
function aeadWriteEnabled() {
	return process.env.DATA_ENCRYPTION_AEAD === 'true'
}

module.exports = class Encryption {

	static buffered({ key, iv }) {
		return {
			key: Buffer.from(key, 'hex'),
			iv: Buffer.from(iv, 'hex')
		}
	}

	/**
	 * AES-256-GCM 加密，輸出版本化 payload：`v2:` + base64(nonce|ciphertext|tag)。
	 * 每次用隨機 nonce，相同明文不會產生相同密文（避免相等性洩漏）。
	 * @param {string} text
	 * @param {{ key: string }} secret
	 * @returns {string}
	 */
	static encryptAEAD(text, { key }) {
		const nonce = crypto.randomBytes(AEAD_NONCE_LENGTH)
		const cipher = crypto.createCipheriv(aeadAlgorithm, Buffer.from(key, 'hex'), nonce, { authTagLength: AEAD_TAG_LENGTH })
		const ciphertext = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()])
		const tag = cipher.getAuthTag()
		return AEAD_PREFIX + Buffer.concat([nonce, ciphertext, tag]).toString('base64')
	}

	/**
	 * 解開 `v2:` 版本化 GCM payload。tag 驗證失敗（竄改／錯金鑰）時丟錯＝fail-closed，
	 * 不回傳可能被竄改的明文、也不回空字串。
	 * @param {string} payload
	 * @param {{ key: string }} secret
	 * @returns {string}
	 */
	static decryptAEAD(payload, { key }) {
		const raw = Buffer.from(payload.slice(AEAD_PREFIX.length), 'base64')
		const nonce = raw.subarray(0, AEAD_NONCE_LENGTH)
		const tag = raw.subarray(raw.length - AEAD_TAG_LENGTH)
		const ciphertext = raw.subarray(AEAD_NONCE_LENGTH, raw.length - AEAD_TAG_LENGTH)
		// 固定 authTagLength 16 bytes：payload 過短或 tag 被截短時 setAuthTag 直接丟錯，
		// 不讓竄改者用短 tag 降低偽造難度。
		const decipher = crypto.createDecipheriv(aeadAlgorithm, Buffer.from(key, 'hex'), nonce, { authTagLength: AEAD_TAG_LENGTH })
		decipher.setAuthTag(tag)
		return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
	}

	static encrypt(text, secret = defaultSecret) {
		if (aeadWriteEnabled()) {
			try {
				return Encryption.encryptAEAD(text, secret)
			} catch (e) {
				return ''
			}
		}

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

	static decrypt(text, secret = defaultSecret) {
		// 新格式：驗 tag、fail-closed（竄改／錯金鑰丟錯，不吞掉）
		if (typeof text === 'string' && text.startsWith(AEAD_PREFIX)) {
			return Encryption.decryptAEAD(text, secret)
		}

		// 舊格式 CBC：維持原本 fail-open（壞資料回空字串），確保現網既有資料照常讀取
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
