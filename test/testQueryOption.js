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
			.FIRST()
			.UPDATED('a')
			.WRITER()
			.ON_ERR('hi')
			.AFFECTED_ROWS(1)
			.CHANGED_ROWS(1)
			.NESTED()
			._options()

		for (const key of Object.keys(options)) {
			const value = options[key]
			const type = typeof value
			switch (type) {
				case 'string':
				case 'number':
				case 'boolean': {
					const a = {
						query: `{"sql":"SET @a := '';SELECT zzz_pool_mysql_testing.id, zzz_pool_mysql_testing.email SET ? FROM zzz_pool_mysql_testing WHERE (?) LIMIT ? AND ((SELECT @a := CONCAT_WS(',', IF(a IS NULL, "{{NULL}}",a), @a)) + 1);SELECT @a a","nestTables":true}`,
						values: `[{"a":1},{"id":1},1]`,
						formatted: `SET @a := '';SELECT zzz_pool_mysql_testing.id, zzz_pool_mysql_testing.email SET \`a\` = 1 FROM zzz_pool_mysql_testing WHERE (\`id\` = 1) LIMIT 1 AND ((SELECT @a := CONCAT_WS(',', IF(a IS NULL, "{{NULL}}",a), @a)) + 1);SELECT @a a`,
						reduceInitiVal: 0,
						nested: true,
						print: true,
						getFirst: true,
						updated: true,
						changedRows: 1,
						affectedRows: 1,
						onErr: 'hi',
						useWriter: true,
						encryption: 'a'
					}

					value.should.equal(a[key])
					break
				}
				case 'function': {
					const a = {
						mapCallback: d => d,
						reduceCallback: (a, b) => a + b,
						filter: d => d
					}

					const b = `${value}`
					b.should.equal(`${a[key]}`)
					break
				}
				case 'object': {
					const a = {
						decryption: ['abc'],
						populates: [{ 'fk': { 'value': {} } }],
						ex: { 'EX': 300, 'redisPrint': true },
						query: { 'sql': 'SET @a := \'\';SELECT zzz_pool_mysql_testing.id, zzz_pool_mysql_testing.email SET ? FROM zzz_pool_mysql_testing WHERE (?) LIMIT ? AND ((SELECT @a := CONCAT_WS(\',\', IF(a IS NULL, "{{NULL}}",a), @a)) + 1);SELECT @a a', 'nestTables': true },
						values: [{ 'a': 1 }, { 'id': 1 }, 1],
					}

					JSON.stringify(value).should.equal(JSON.stringify(a[key]))
					break
				}
				default:
					assert.fail('not handled', key, value)
			}
		}

		const string = '{"query":{"sql":"SET @a := \'\';SELECT zzz_pool_mysql_testing.id, zzz_pool_mysql_testing.email SET ? FROM zzz_pool_mysql_testing WHERE (?) LIMIT ? AND ((SELECT @a := CONCAT_WS(\',\', IF(a IS NULL, \\"{{NULL}}\\",a), @a)) + 1);SELECT @a a","nestTables":true},"values":[{"a":1},{"id":1},1],"formatted":"SET @a := \'\';SELECT zzz_pool_mysql_testing.id, zzz_pool_mysql_testing.email SET `a` = 1 FROM zzz_pool_mysql_testing WHERE (`id` = 1) LIMIT 1 AND ((SELECT @a := CONCAT_WS(\',\', IF(a IS NULL, \\"{{NULL}}\\",a), @a)) + 1);SELECT @a a","reduceInitiVal":0,"nested":true,"print":true,"getFirst":true,"updated":true,"changedRows":1,"affectedRows":1,"onErr":"hi","decryption":["abc"],"populates":[{"fk":{"value":{}}}],"useWriter":true,"encryption":"a","ex":{"EX":300,"redisPrint":true}}'
		JSON.stringify(options).should.equal(string)
	})
})
