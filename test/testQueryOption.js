const { should, expect, assert } = require('chai')  // Using Assert style
should()

const pool = require('../index')
const ZZZPoolMysqlTesting = require('./model/zzz_pool_mysql_testing')

describe('test Query Option', async () => {
	it('should pass', async () => {

		const options = ZZZPoolMysqlTesting
			.SELECT()
			.SET({ a: 1 }, undefined, { encryption: 'a' })
			.FROM()
			.WHERE({ id: 1 })
			.NESTTABLES()
			.MAP(d => d)
			.REDUCE((a, b) => a + b, 0)
			.FILTER(d => d)
			.COMBINE()
			.DECRYPT('abc')
			.POPULATE({ fk: { value: {} } })
			.EX(300)
			.PRINT()
			._options()


		console.log(JSON.stringify(options))

		JSON.stringify(options).should.equal('{"query":{"sql":"SELECT zzz_pool_mysql_testing.id, zzz_pool_mysql_testing.email SET ? FROM zzz_pool_mysql_testing WHERE (?)","nestTables":true},"values":[{"a":1},{"id":1}],"formatted":"SELECT zzz_pool_mysql_testing.id, zzz_pool_mysql_testing.email SET `a` = 1 FROM zzz_pool_mysql_testing WHERE (`id` = 1)","reduceInitiVal":0,"print":true,"decryption":["abc"],"populates":[{"fk":{"value":{}}}],"encryption":"a","ex":{"EX":300,"redisPrint":true}}')
	})
})
