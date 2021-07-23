require('dotenv').config({ path: '.env' })

const Trips = require('../testModels/Trips')
const expect = require('chai').expect
const assert = require('assert')

describe('test stream', () => {
	function toExpect(rows) {
		expect(rows[0]).haveOwnProperty('trip_id')
		expect(rows[0]).haveOwnProperty('user')
	}


	it('success', ok => {
		Trips
			.SELECT()
			.FROM()
			.LEFTJOIN('user_info on user_info.uid = trips.user_id')
			.LIMIT(25)
			.NESTTABLES()
			.MAP(data => {
				const trip = data.trips
				return { ...trip, user: data.user_info }
			})
			.stream({
				highWaterMark: 5,
				onValue: (rows, done) => {
					toExpect(rows)
					assert.equal(rows.length, 5)

					done()
				},
				onEnd: (error) => {
					ok()
				}
			})
	})

	it('success single', ok => {
		Trips
			.SELECT()
			.FROM()
			.LEFTJOIN('user_info on user_info.uid = trips.user_id')
			.LIMIT(30)
			.NESTTABLES()
			.MAP(data => {
				const trip = data.trips
				return {
					...trip,
					user: data.user_info
				}
			})
			.stream({
				highWaterMark: 1,
				onValue: (row, done) => {
					toExpect([row])

					done()
				},
				onEnd: (error) => {
					ok()
				}
			})
	})

	it('success async/await', ok => {
		Trips
			.SELECT()
			.FROM()
			.LEFTJOIN('user_info on user_info.uid = trips.user_id')
			.LIMIT(30)
			.NESTTABLES()
			.MAP(data => {
				const trip = data.trips
				return {
					...trip,
					user: data.user_info
				}
			})
			.stream({
				highWaterMark: 1,
				onValue: async (row, _) => {
					toExpect([row])
				},
				onEnd: (error) => {
					ok()
				}
			})
	})
})
