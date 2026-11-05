process.env.NODE_ENV = 'TESTING'

const { expect } = require('chai')
const mysql = require('mysql')
const { Polygon } = require('../src/Schema/Types')

function sqlOf(rawValue) {
	return rawValue && typeof rawValue.toSqlString === 'function' ? rawValue.toSqlString() : String(rawValue)
}

describe('Polygon inputMapper SQL injection (LT-29090)', () => {
	it('非數值座標直接擋掉，不拼進 raw SQL', () => {
		const malicious = [[
			{ x: '0) OR 1=1 -- ', y: 25 },
			{ x: 121.5, y: 25.02 },
			{ x: '0) OR 1=1 -- ', y: 25 },
		]]

		expect(() => Polygon.inputMapper(malicious)).to.throw()
	})

	it('合法數值座標輸出 escaped 的 ST_GeomFromText 字面值（座標不直接拼接）', () => {
		const valid = [[
			{ x: 121.5, y: 25.0 },
			{ x: 121.6, y: 25.1 },
			{ x: 121.5, y: 25.0 },
		]]

		const sql = sqlOf(Polygon.inputMapper(valid))
		expect(sql).to.equal(`ST_GeomFromText(${mysql.escape('POLYGON((121.5 25,121.6 25.1,121.5 25))')})`)
	})

	it('數值字串座標會被正規化為數字', () => {
		const valid = [[
			{ x: '121.5', y: '25' },
			{ x: '121.6', y: '25.1' },
			{ x: '121.5', y: '25' },
		]]

		const sql = sqlOf(Polygon.inputMapper(valid))
		expect(sql).to.equal(`ST_GeomFromText(${mysql.escape('POLYGON((121.5 25,121.6 25.1,121.5 25))')})`)
	})
})
