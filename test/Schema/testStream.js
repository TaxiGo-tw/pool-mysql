require('dotenv').config({ path: '.env' })

const Trips = require('../testModels/Trips')
const expect = require('chai').expect
const assert = require('assert')


describe('test stream', () => {
	it('success', ok => {
		Trips
			.SELECT()
			.FROM()
			.LEFTJOIN('user_info on user_info.uid = trips.user_id')
			.LIMIT(25)
			.NESTTABLES()
			.MAP(data => {
				const trip = data.trips
				return {
					...trip,
					user: data.user_info
				}
			})
			.stream({
				highWaterMark: 5,
				onValue: (rows, done) => {
					console.log('onValue', rows.length)
					done()
				},
				onEnd: (error) => {
					console.log('onEnd')

					ok()
				}
			})
	})
})
