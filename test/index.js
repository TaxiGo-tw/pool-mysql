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

Event.on('release', (title, connection) => console.log(title, 'connections released', connection.tag.name))

Event.on('warn', (title, warn) => console.warn(title, warn))
Event.on('err', (title, err) => console.error(title, err))

// Event.on('log', console.log)
Event.on('print', console.log)

const pool = require('../src/Pool')

describe('test recycle', () => {
	// it('recycle', (done) => {
	// 	async function select(i) {
	// 		try {
	// 			const connection = pool.connection({ limit: 10 })
	// 			await connection.q('select 1')
	// 			connection.release()

	// 			if (i == count) {
	// 				done()
	// 			}
	// 		} catch (error) {
	// 			assert.fail(error)
	// 		}
	// 	}

	// 	const count = 50

	// 	for (let i = 1; i <= count; i++) {
	// 		setTimeout(async () => await select(i), 300)
	// 	}
	// })


	function genConnections({ priority, limit }, amount) {
		const array = []
		for (let i = 0; i < amount; i++) {
			array.push(pool.connection({ priority, limit }))
		}
		return array
	}

	it('test priority', async () => {
		const ls = genConnections({ priority: 0 }, 50)
		for (const c of ls) {
			c.genReader().then(c => console.log('got', c.tag.name))
		}

		console.log('======================')

		const hs = genConnections({ priority: 1 }, 20)

		for (const connection of hs) {
			connection.genReader().then(c => {
				console.log('got', c.tag.name)
				connection.release()
			})
		}
		// hs[0].genReader().then(c => console.log('got', c.tag.name)).catch(console.error)
		// hs[1].genReader().then(c => console.log('got', c.tag.name)).catch(console.error)
		// hs[2].genReader().then(c => console.log('got', c.tag.name)).catch(console.error)
		// hs[3].genReader().then(c => console.log('got', c.tag.name)).catch(console.error)
		// hs[4].genReader().then(c => console.log('got', c.tag.name)).catch(console.error)
		// hs[5].genReader().then(c => console.log('got', c.tag.name)).catch(console.error)
		// hs[6].genReader().then(c => console.log('got', c.tag.name)).catch(console.error)
		// hs[7].genReader().then(c => console.log('got', c.tag.name)).catch(console.error)
		// hs[8].genReader().then(c => console.log('got', c.tag.name)).catch(console.error)
		// hs[9].genReader().then(c => console.log('got', c.tag.name)).catch(console.error)

		setTimeout(() => {
			console.log('rrrr')
			for (const c of ls) {
				c.release()
			}

		}, 1000)
	})
})
