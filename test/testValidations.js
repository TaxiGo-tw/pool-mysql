const DriverReviewStatus = require('./model/DriverReviewStatus')

const { should } = require('chai')  // Using Assert style
should()  // Modifies `Object.prototype`
const assert = require('assert')


const { Num, Str, Email, JSONString, NumberString } = require('../model/Schema').Types

describe('test model Validations', async () => {
	it('get pk ', async () => {
		DriverReviewStatus._pk.should.equal('uid')
	})
})


describe('test Validations', async () => {
	it('string', async () => {
		assert.equal(Str.validate('hi'), true)
		assert.equal(Str.validate(1), false)
		assert.equal(Str.validate(true), false)
		assert.equal(Str.validate(new Date()), false)
	})

	it('number', async () => {
		assert.equal(Num.validate('hi'), false)
		assert.equal(Num.validate(1), true)
		assert.equal(Num.validate(true), false)
		assert.equal(Num.validate(new Date()), false)
	})

	it('JSON String', async () => {
		assert.equal(JSONString.validate('{}'), true)
		assert.equal(JSONString.validate('{"hi":1}'), true)
		assert.equal(JSONString.validate('{\"hi\":1}'), true)
		assert.equal(JSONString.validate('{hi:1}'), false)
		assert.equal(JSONString.validate(''), false)
	})

	it('Email String', async () => {
		assert.equal(Email.validate('12312gggg@gmail.com'), true)
		assert.equal(Email.validate('@gmail'), false)
		assert.equal(Email.validate('12312gggg@gmail'), false)
		assert.equal(Email.validate('{"hi":1}'), false)
		assert.equal(Email.validate('{___}'), false)
		assert.equal(Email.validate('{hi:1}'), false)
		assert.equal(Email.validate(''), false)
	})

	it('Number String', async () => {
		assert.equal(NumberString.validate('123'), true)
		assert.equal(NumberString.validate('33312'), true)
		// assert.equal(NumberString.validate('12312gggg@gmail'), false)
		// assert.equal(NumberString.validate('{"hi":1}'), false)
		// assert.equal(NumberString.validate('{___}'), false)
		// assert.equal(NumberString.validate('{hi:1}'), false)
		// assert.equal(NumberString.validate(''), false)
	})
})

describe('test JSON model Validations', async () => {
	it('JSON model pass', async () => {
		const obj = new DriverReviewStatus({
			uid: 123,
			first_name: 'lova5',
			last_name: 'hi',
			email: '123@gg.mail',
			car_brand: '{"brand":"bmw"}',
			phone_number: '0911957274',
			plate_number: '123-AAA'
		})

		assert(obj.validate(true))
	})

	it('JSON model pass 2', async () => {
		const obj = new DriverReviewStatus({
			uid: 123,
			first_name: 'lova5',
			last_name: 'hi',
			email: '123@gg.mail',
			car_brand: '{"brand":"bmw"}'
		})

		assert(obj.validate())
	})

	it('JSON model pass 2', async () => {
		const obj = new DriverReviewStatus({
			uid: 123,
		})

		assert(obj.validate())

		const obj2 = new DriverReviewStatus({ last_name: 123 })
		assert.throws(() => { obj2.validate() }, `driver_review_status.last_name must be type: 'Str', not 'number' {"last_name":123}`)

		const obj3 = new DriverReviewStatus({ last_name: 123 })
		assert.throws(() => { obj3.validate(true) }, `uid is required`)

	})


	it('JSON model', async () => {
		const obj = new DriverReviewStatus({ uid: 123, first_name: 'lova', email: '123@gg.mail', car_brand: '' })

		const errorMessage = 'driver_review_status.car_brand must be type: JSONString {"uid":123,"first_name":"lova","email":"123@gg.mail","car_brand":""}'
		assert.throws(() => { obj.validate(true) }, errorMessage)
	})
})
