require('dotenv').config({ path: '.env' })
process.env.NODE_ENV = 'TESTING'



require('dotenv').config({ path: '.env' })
const { assert } = require('chai')
const Event = require('../src/Logger/Event')

Event.on('did_create', (title, connection) => console.log(title, 'connections created'))
Event.on('get', (title, connection) => console.log(title, 'connections get'))

Event.on('amount', (title, amount) => console.log(title, 'connections amount', amount))
Event.on('request', (title, amount) => console.log(title, 'connection 額滿使用中', amount))
Event.on('recycle', (title, connection) => console.log(title, `connection 排隊解除`, connection.tag.name))
Event.on('end', (title, _) => console.log(title, 'connection end'))

Event.on('release', (title, connection) => console.log(title, 'connections released', connection.tag.name))

Event.on('warn', (title, warn) => console.warn(title, warn))
Event.on('err', (title, err) => console.error(title, err))

// Event.on('log', console.log)
Event.on('print', console.log)

const pool = require('../src/Pool')

describe('test recycle', () => {
	it.skip('recycle', (done) => {
		async function select(i) {
			try {
				const connection = pool.connection({ limit: 10 })
				await connection.q('select 1')
				connection.release()

				if (i == count) {
					done()
				}
			} catch (error) {
				assert.fail(error)
			}
		}

		const count = 50

		for (let i = 1; i <= count; i++) {
			setTimeout(async () => await select(i), 300)
		}
	})

	it('test priority', done => {
		function genConnections({ priority, limit }, amount) {
			const array = []
			for (let i = 0; i < amount; i++) {
				array.push(pool.connection({ priority, limit }))
			}
			return array
		}

		let i = 0
		for (const connection of genConnections({ priority: 5, limit: 15 }, 30)) {
			connection.genReader()
				.then(_ => setTimeout(() => connection.release(), 300))
				.catch(console.error)
		}

		for (const connection of genConnections({ priority: 0, limit: 30 }, 30)) {
			connection.genReader()
				.then(_ => {
					i++

					if (i == 30) {
						setTimeout(() => done(), 500)
					}

					return setTimeout(() => connection.release(), 300)
				})
				.catch(console.error)
		}
	})
})
