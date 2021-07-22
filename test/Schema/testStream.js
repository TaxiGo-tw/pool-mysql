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
				return { ...trip, user: data.user_info }
			})
			.stream({
				highWaterMark: 5,
				onValue: (rows, done) => {
					assert.equal(rows.length, 5)
					expect(rows[0]).haveOwnProperty('trip_id')
					expect(rows[0]).haveOwnProperty('user')

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
					expect(row).haveOwnProperty('trip_id')
					expect(row).haveOwnProperty('user')

					done()
				},
				onEnd: (error) => {
					ok()
				}
			})
	})
})
