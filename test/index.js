//create connection test
(async () => {
	require('dotenv').config({ path: '.env' })

	const Event = require('../src/Logger/Event')
	Event.on('amount', amount => console.log('pool-mysql connections amount :', amount))
	Event.on('request', amount => console.log('pool-mysql connection 額滿使用中', amount))
	Event.on('recycle', () => console.log('pool-mysql connection 排隊解除'))

	const pool = require('../src/Pool')
	for (let i = 0; i < 50; i++) {
		pool.createConnection()
			.then(c => setTimeout(() => c.release(), 500))
			.catch(e => console.log('get timeout'))
	}
})()
