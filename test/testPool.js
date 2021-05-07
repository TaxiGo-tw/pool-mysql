const { should } = require('chai')  // Using Assert style
should()  // Modifies `Object.prototype`
const assert = require('assert')

const pool = require('../model/Pool')

const options = require('../model/DefaultOptions')
const pool2 = pool.createPool({ options })

describe('test data mock', async () => {

	it('should finish a query', async () => {
		const connection = await pool2.createConnection()

		const [trip] = await connection.q('select * from trips limit 1')
		connection.release()

		trip.should.have.property('trip_id')
	})

})
