//create connection test
(async () => {
	require('dotenv').config({ path: '.env' })

	const pool = require('../model/Pool')
	pool.event.on('amount', amount => console.log('pool-mysql connections amount :', amount))
	pool.event.on('request', amount => console.log('pool-mysql connection 額滿使用中', amount))
	pool.event.on('recycle', () => console.log('pool-mysql connection 排隊解除'))

	for (let i = 0; i < 50; i++) {
		pool.createConnection()
			.then(c => setTimeout(() => c.release(), 500))
			.catch(e => console.log('get timeout'))
	}
})()
