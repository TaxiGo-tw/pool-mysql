
const { should } = require('chai')  // Using Assert style
should()  // Modifies `Object.prototype`
const assert = require('assert')


const { Validations } = require('../model/Schema')

describe('test Validations', async () => {
	it('string', async () => {
		assert.equal(Validations.isString('hi'), true)
		assert.equal(Validations.isString(1), false)
		assert.equal(Validations.isString(true), false)
		assert.equal(Validations.isString(new Date()), false)
	})

	it('number', async () => {
		assert.equal(Validations.isNUMBER('hi'), false)
		assert.equal(Validations.isNUMBER(1), true)
		assert.equal(Validations.isNUMBER(true), false)
		assert.equal(Validations.isNUMBER(new Date()), false)
	})

	it('JSON String', async () => {
		assert.equal(Validations.isJSONString('{}'), true)
		assert.equal(Validations.isJSONString('{"hi":1}'), true)
		assert.equal(Validations.isJSONString('{\"hi\":1}'), true)
		assert.equal(Validations.isJSONString('{hi:1}'), false)
		assert.equal(Validations.isJSONString(''), false)
	})
})
