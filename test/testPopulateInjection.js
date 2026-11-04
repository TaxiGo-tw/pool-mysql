process.env.NODE_ENV = 'TESTING'

const { expect } = require('chai')
const mysql = require('mysql')
const Populate = require('../src/Schema/Populate')

// 記錄 populate 後續查詢實際帶出去的 WHERE clause 與綁定值，不碰 DB
function makeFakeModel() {
	const rec = { where: null }
	const chain = {
		SELECT() { return chain },
		FROM() { return chain },
		WHERE(clause, values) { rec.where = { clause, values }; return chain },
		PRINT() { return chain },
		async exec() { return [] },
	}
	return { chain, rec }
}

function makeFK(model, column) {
	// 名稱必須是 'FK'，typeAndColumn 以此判斷是外鍵
	function FK() {}
	FK.model = model
	FK.column = column
	return FK
}

// 之前查回的 row 值會被二次帶進 IN (...)；這個值若被字串拼接就能跳脫出 IN
const MALICIOUS = '0) OR 1=1 -- '

describe('Populate second-order SQL injection (LT-29089)', () => {
	it('single-object populate 以 IN (?) 綁定 ids，不拼字串', async () => {
		const { chain, rec } = makeFakeModel()
		const populateType = { ref: makeFK(chain, 'coupon_id'), column: 'coupon_id' }

		await Populate.find({
			this: { connection: {}, columns: { coupon: populateType }, constructor: function Model() {} },
			results: [{ coupon_id: MALICIOUS }, { coupon_id: 7 }],
			populates: ['coupon'],
			print: false,
			Schema: { Types: { PK: {} } },
		})

		expect(rec.where, 'populate 應該有發出後續查詢').to.not.equal(null)
		expect(rec.where.clause).to.equal('coupon_id IN (?)')
		expect(rec.where.values).to.deep.equal([[MALICIOUS, 7]])
		// 綁定後惡意值被跳脫成字串字面值，無法改變查詢結構
		const formatted = mysql.format(rec.where.clause, rec.where.values)
		expect(formatted).to.equal("coupon_id IN ('0) OR 1=1 -- ', 7)")
	})

	it('array populate 以 IN (?) 綁定 ids，不拼字串', async () => {
		const { chain, rec } = makeFakeModel()
		const populateType = [makeFK(chain, 'trip_id')]

		await Populate.find({
			this: { connection: {}, columns: { coupons: populateType }, constructor: function Model() {} },
			results: [{ trip_id: MALICIOUS }, { trip_id: 42 }],
			populates: ['coupons'],
			print: false,
			Schema: { Types: { PK: {} } },
		})

		expect(rec.where, 'populate 應該有發出後續查詢').to.not.equal(null)
		expect(rec.where.clause).to.equal('trip_id in (?)')
		expect(rec.where.values).to.deep.equal([[MALICIOUS, 42]])
	})
})
