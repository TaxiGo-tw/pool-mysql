
const Trips = require('../../app/Schema/Trips.js')
const expect = require('chai').expect
const assert = require('assert')


describe('test stream', () => {
	it('success', (done) => {

		let counter = 0

		Trips
			.SELECT()
			.FROM()
			.WHERE({ user_id: 3925 })
			.LIMIT(500)
			.stream({
				res: {
					setHeader: () => { },
					write: (object) => {
						counter++
						assert.ok(typeof object === 'object')
					},
					end: () => {
						assert.equal(counter, 500)
						done()
					}
				}
			})
	})

	it('fail', (end) => {
		Trips
			.UPDATE('user_info')
			.SET({ uid: 31 })
			.WHERE({ uid: 31 })
			.stream({
				res: {
					setHeader: () => { },
					write: () => { },
					end
				}
			})
	})
})
