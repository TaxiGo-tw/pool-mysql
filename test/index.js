//create connection test
(async () => {
	require('dotenv').config({ path: '.env' })

	const Event = require('../src/Logger/Event')
	Event.on('amount', (amount, role) => console.log('pool-mysql connections amount :', amount, role))
	Event.on('request', (amount, role) => console.log('pool-mysql connection 額滿使用中', amount, role))
	Event.on('recycle', () => console.log('pool-mysql connection 排隊解除'))

	const pool = require('../src/Pool')
	for (let i = 0; i < 50; i++) {
		pool.createConnection()
			.then(c => setTimeout(async () => {
				await c.q('select 1')
				c.release()
			}, 500))
			.catch(e => console.log('get timeout'))
	}
})()
