require('dotenv').config({ path: '.env' })

const Trips = require('../testModels/Trips')
const expect = require('chai').expect
const assert = require('assert')


describe('test stream', () => {
	it('success', done => {

		let counter = 0

		const res = {
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

		Trips
			.SELECT()
			.FROM()
			.WHERE({ user_id: 3925 })
			.LIMIT(500)
			.readableStream({ res })
	})

	it('Stream query must be SELECT', done => {
		const res = {
			setHeader: () => { },
			write: () => { },
			end: done
		}


		Trips
			.UPDATE('user_info')
			.SET({ uid: 31 })
			.WHERE({ uid: 31 })
			.readableStream({ res })
			.then(assert)
			.catch(err => done())
	})
})
