const { should, expect } = require('chai')  // Using Assert style
should()  // Modifies `Object.prototype`

const updated = require('../src/Schema/Updated').handler

describe('test Updated', async () => {
	it('normal case', async () => {
		const input = {
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
		}

		const output = [
			{ id: '1', name: 'test' },
			{ id: '2', name: 'name' },
			{ id: '3', name: undefined }
		]

		const results = updated(input)

		expect(results).to.eql(output)
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

		const results = updated(input)

		expect(results).to.eql(output)
	})
})
