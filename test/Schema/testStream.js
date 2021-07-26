require('dotenv').config({ path: '.env' })

const Trips = require('../testModels/Trips')
const expect = require('chai').expect
const assert = require('assert')

describe('test stream', () => {
	it('success', ok => {
		Query().stream({
			highWaterMark: 5,
			onValue: (rows, done) => {
				toExpect(rows)
				assert.strictEqual(rows.length, 5)

				done()
			},
			onEnd: ok
		})
	})

	it('success single', ok => {
		Query().stream({
			highWaterMark: 1,
			onValue: (row, done) => {
				toExpect([row])
				assert.strictEqual(typeof row, 'object')

				done()
			},
			onEnd: ok
		})
	})

	it('success async/await', ok => {
		Query().stream({
			highWaterMark: 1,
			onValue: async (row, _) => {
				toExpect([row])
				assert.strictEqual(typeof row, 'object')
			},
			onEnd: ok
		})
	})

	function toExpect([firstRow]) {
		expect(firstRow).haveOwnProperty('trip_id')
		expect(firstRow).haveOwnProperty('user')
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
