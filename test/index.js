require('dotenv').config({ path: '.env' })
process.env.NODE_ENV = 'TESTING'



require('dotenv').config({ path: '.env' })
const { assert } = require('chai')
const Event = require('../src/Logger/Event')
Event.on('amount', (role, amount) => console.log('pool-mysql connections amount :', role, amount))
Event.on('request', (role, amount) => console.log('pool-mysql connection 額滿使用中', role, amount))
Event.on('recycle', (mysqlConnection) => console.log(`pool-mysql connection 排隊解除`))

const pool = require('../src/Pool')

describe('test recycle', () => {
	it('recycle', (done) => {
		const count = 50

		for (let i = 1; i <= count; i++) {
			setTimeout(async () => {
				pool.createConnection({ limit: 10 })
					.then(c => {
						setTimeout(async () => {
							console.time(i)
							await c.q('select 1')
							console.timeEnd(i)
							c.release()

							if (i == count) {
								done()
							}
						}, 300)
						return
					})
					.catch(e => assert.fail(e))
			}, i * 3)
		}
	})

})
