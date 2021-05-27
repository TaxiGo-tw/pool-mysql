require('dotenv').config({ path: '.env' })
process.env.NODE_ENV = 'TESTING'



require('dotenv').config({ path: '.env' })
const { assert } = require('chai')
const Event = require('../src/Logger/Event')

Event.on('did_create', (title, connection) => console.log(title, 'connections created'))
Event.on('get', (title, connection) => console.log(title, 'connections get'))

Event.on('amount', (title, amount) => console.log(title, 'connections amount', amount))
Event.on('request', (title, amount) => console.log(title, 'connection 額滿使用中', amount))
Event.on('recycle', (title) => console.log(title, `connection 排隊解除`))
Event.on('end', (title, _) => console.log(title, 'connection end'))

Event.on('release', (title, connection) => console.log(title, 'connections released'))

Event.on('warn', (title, warn) => console.warn(title, warn))
Event.on('err', (title, err) => console.error(title, err))

// Event.on('log', console.log)
Event.on('print', console.log)

const pool = require('../src/Pool')

describe('test recycle', () => {
	it('recycle', (done) => {
		const count = 50

		for (let i = 1; i <= count; i++) {
			setTimeout(async () => {
				pool.createConnection({ limit: 10 })
					.then(c => {
						setTimeout(async () => {
							await c.q('select 1')
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
