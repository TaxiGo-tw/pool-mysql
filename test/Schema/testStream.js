require('dotenv').config({ path: '.env' })

const Trips = require('../testModels/Trips')
const expect = require('chai').expect
const assert = require('assert')

describe('test stream', () => {
	it('success', ok => {
		Query()
			.stream({
				highWaterMark: 5,
				onValue: (rows, done) => {
					toExpect(rows)
					assert.strictEqual(rows.length, 5)

					done()
				},
				onEnd: error => {
					ok(error)
				}
			})
	})

	it('success single', ok => {
		Query()
			.stream({
				highWaterMark: 1,
				onValue: (row, done) => {
					toExpect([row])
					assert.strictEqual(typeof row, 'object')

					done()
				},
				onEnd: error => {
					ok(error)
				}
			})
	})

	it('success async/await', ok => {
		Query()
			.stream({
				highWaterMark: 1,
				onValue: async (row, _) => {
					toExpect([row])
					assert.strictEqual(typeof row, 'object')
				},
				onEnd: error => {
					ok(error)
				}
			})
	})

	function toExpect(rows) {
		expect(rows[0]).haveOwnProperty('trip_id')
		expect(rows[0]).haveOwnProperty('user')
	}

	function Query() {
		return Trips
			.SELECT()
			.FROM()
			.LEFTJOIN('user_info on user_info.uid = trips.user_id')
			.LIMIT(30)
			.NESTTABLES()
			.MAP(data => {
				const trip = data.trips
				return { ...trip, user: data.user_info }
			})
	}
})
