const { should, expect, assert } = require('chai')  // Using Assert style
should()  // Modifies `Object.prototype`

const { handler } = require('../src/Schema/Updated')

describe('test Updated', async () => {
	it('normal case', async () => {
		expect(handler({
			results: [
				{},
				{ affectedRows: 1 },
				[
					{
						id: '1,2,3,',
						name: 'test,name,{{NULL}}'
					}
				]
			]
		})).to.eql([
			{ id: '1', name: 'test' },
			{ id: '2', name: 'name' },
			{ id: '3', name: undefined }
		])
	})

	it('amount', () => {
		const input = {
			results: [
				{},
				{ affectedRows: 1 },
				[{ amount: '-1,' }]
			]
		}

		const output = [{ amount: '-1' }]

		const results = handler(input)

		expect(results).to.eql(output)
	})

	const Trips = require('./testModels/Trips')

	it('test -1 in value', async () => {
		const [{ trip_id }] = await Trips.SELECT('trip_id').FROM().LIMIT(1).exec()

		const results = await Trips.UPDATE()
			.SET({ driver_id: -1 })
			.WHERE({ trip_id })
			.UPDATED('user_id', 'driver_id')
			.rollback()

		results[0].should.have.property('driver_id')
		results[0].should.have.property('user_id')
	})

	it('test nothing updated', async () => {
		const results = await Trips.UPDATE()
			.SET({ driver_id: -1, user_id: -1 })
			.WHERE({ trip_id: 1 })
			.UPDATED('driver_id')
			.rollback()

		results.should.eql([])
	})

	it('test updated empty field', async () => {
		const results = await Trips.UPDATE()
			.SET({ driver_id: -1, user_id: -1 })
			.WHERE({ trip_id: 2 })
			.UPDATED('driver_id', 'start_address')
			.rollback()

		results.should.eql([
			{
				'driver_id': "6",
				'start_address': ""
			}
		])
	})
})
