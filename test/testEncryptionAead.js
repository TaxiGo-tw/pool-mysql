const crypto = require('crypto')
const { assert, expect } = require('chai')

const Encryption = require('../src/Schema/Encryption')

// 自帶金鑰，不依賴 DB 或 .env，純 crypto 驗證
const secret = {
	key: crypto.randomBytes(32).toString('hex'),
	iv: crypto.randomBytes(16).toString('hex')
}

const AEAD_FLAG = 'DATA_ENCRYPTION_AEAD'

describe('Encryption AEAD (LT-29091)', () => {
	afterEach(() => {
		delete process.env[AEAD_FLAG]
	})

	describe('預設（flag 關）維持舊 CBC 行為，merge 後執行時零改變', () => {
		it('encrypt 不帶 v2 前綴，輸出為 hex', () => {
			delete process.env[AEAD_FLAG]

			const cipher = Encryption.encrypt('abc', secret)

			expect(cipher).to.not.match(/^v2:/)
			expect(cipher).to.match(/^[0-9a-f]+$/)
		})

		it('CBC round-trip 可解回原文', () => {
			delete process.env[AEAD_FLAG]

			const cipher = Encryption.encrypt('0912345678', secret)
			assert.strictEqual(Encryption.decrypt(cipher, secret), '0912345678')
		})

		it('壞掉的 legacy 值維持 fail-open 回空字串', () => {
			delete process.env[AEAD_FLAG]

			assert.strictEqual(Encryption.decrypt('zzzz', secret), '')
		})
	})

	describe('flag 開＝改寫 AES-256-GCM', () => {
		beforeEach(() => {
			process.env[AEAD_FLAG] = 'true'
		})

		it('encrypt 產生 v2 版本化 payload', () => {
			const cipher = Encryption.encrypt('abc', secret)
			expect(cipher).to.match(/^v2:/)
		})

		it('GCM round-trip 可解回原文', () => {
			const cipher = Encryption.encrypt('0912345678', secret)
			assert.strictEqual(Encryption.decrypt(cipher, secret), '0912345678')
		})

		it('相同明文每次 ciphertext 不同（random nonce，無相等洩漏）', () => {
			const a = Encryption.encrypt('same-plaintext', secret)
			const b = Encryption.encrypt('same-plaintext', secret)
			expect(a).to.not.equal(b)
			// 但兩者都能各自解回原文
			assert.strictEqual(Encryption.decrypt(a, secret), 'same-plaintext')
			assert.strictEqual(Encryption.decrypt(b, secret), 'same-plaintext')
		})
	})

	describe('完整性：GCM 被竄改必須 fail-closed（丟錯，不回 plaintext 也不回空字串）', () => {
		it('改一個 byte 後 decrypt 丟錯', () => {
			process.env[AEAD_FLAG] = 'true'
			const cipher = Encryption.encrypt('sensitive-pii', secret)

			// 在 raw byte 層翻轉一個 byte（翻 base64 字元可能落在 padding 的 don't-care bit，
			// 解出來的 bytes 不變，無法保證真的竄改到），改尾端 tag 的最後一個 byte
			const raw = Buffer.from(cipher.slice('v2:'.length), 'base64')
			raw[raw.length - 1] = raw[raw.length - 1] ^ 0xff
			const tampered = 'v2:' + raw.toString('base64')

			expect(() => Encryption.decrypt(tampered, secret)).to.throw()
		})

		it('改 ciphertext（非 tag）後 decrypt 也丟錯', () => {
			process.env[AEAD_FLAG] = 'true'
			const cipher = Encryption.encrypt('sensitive-pii', secret)

			// 翻 ciphertext 中段一個 byte（nonce 12 bytes 之後、tag 16 bytes 之前）
			const raw = Buffer.from(cipher.slice('v2:'.length), 'base64')
			raw[13] = raw[13] ^ 0xff
			const tampered = 'v2:' + raw.toString('base64')

			expect(() => Encryption.decrypt(tampered, secret)).to.throw()
		})

		it('短 tag（authTagLength 固定 16）在 setAuthTag 以長度錯誤丟出，不讓短 tag 降低偽造難度', () => {
			process.env[AEAD_FLAG] = 'true'
			// raw 12 bytes → tag slice 變成合法 GCM 長度的 4 bytes；未固定 authTagLength 時會被接受，
			// 固定 16 bytes 後 setAuthTag 直接以「tag length」錯誤丟出。
			const shortTagPayload = 'v2:' + crypto.randomBytes(12).toString('base64')
			expect(() => Encryption.decrypt(shortTagPayload, secret)).to.throw(/tag length/i)
		})
	})

	describe('向下相容：舊 CBC 資料在 flag 開後仍可讀', () => {
		it('先用 CBC 寫入的值，flag 開後 decrypt 仍解得回原文', () => {
			// 以 flag 關的狀態寫入（= 現網既有資料）
			delete process.env[AEAD_FLAG]
			const legacy = Encryption.encrypt('legacy-0987654321', secret)
			expect(legacy).to.not.match(/^v2:/)

			// 切到 flag 開（rollout 後），讀舊資料
			process.env[AEAD_FLAG] = 'true'
			assert.strictEqual(Encryption.decrypt(legacy, secret), 'legacy-0987654321')
		})
	})
})
