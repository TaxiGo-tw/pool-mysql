const { should, expect } = require('chai')  // Using Assert style
should()  // Modifies `Object.prototype`

const updated = require('../../src/Schema/Updated').handler

describe('test Updated', async () => {
	it('normal case', async () => {
		const results = updated({
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
		})

		expect(results).to.eql([
			{ id: '1', name: 'test' },
			{ id: '2', name: 'name' },
			{ id: '3', name: undefined }
		])
	})

	it('amount', () => {
		const results = updated({
			results: [
				{},
				{ affectedRows: 1 },
				[{ amount: '-1,' }]
			]
		})

		expect(results).to.eql([{ amount: '-1' }])
	})
})
