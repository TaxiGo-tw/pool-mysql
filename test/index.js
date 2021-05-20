require('dotenv').config({ path: '.env' })
const { assert } = require('chai')
const Event = require('../src/Logger/Event')
Event.on('amount', (amount, role) => console.log('pool-mysql connections amount :', amount, role))
Event.on('request', (amount, role) => console.log('pool-mysql connection 額滿使用中', amount, role))
Event.on('recycle', (mysqlConnection) => console.log(`pool-mysql connection 排隊解除`))

const pool = require('../src/Pool')

describe('test recycle', () => {
	it('recycle', (done) => {
		for (let i = 1; i <= 50; i++) {
			setTimeout(async () => {
				pool.createConnection({ limit: 10 })
					.then(c => {
						setTimeout(async () => {
							console.time(i)
							await c.q('select 1')
							console.timeEnd(i)
							c.release()

							if (i == 50) {
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
