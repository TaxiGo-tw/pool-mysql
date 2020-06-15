const DriverReviewStatus = require('./model/DriverReviewStatus')

const { should } = require('chai')  // Using Assert style
should()  // Modifies `Object.prototype`
const assert = require('assert')


const { Num, Str, Email, JSONString, NumberString, Point } = require('../model/Schema').Types

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
		assert.equal(NumberString.validate('12312gggg@gmail'), false)
		assert.equal(NumberString.validate('{"hi":1}'), false)
		assert.equal(NumberString.validate('{___}'), false)
		assert.equal(NumberString.validate('{hi:1}'), false)
	})

	it('POINT String', async () => {
		assert.equal(Point.validate('25.5, 123.5'), true)
		assert.equal(Point.validate('25.5,123.5'), true)
		assert.equal(Point.validate('25,123'), true)
		assert.equal(Point.validate('25,123.5'), true)

		assert.equal(Point.validate('25, 123'), true)
		assert.equal(Point.validate('POINT(25.5, 123)'), true)
		assert.equal(Point.validate('POINT(25.5, 123.5)'), true)


		assert.equal(Point.validate({ x: 25, y: 123 }), true)
		assert.equal(Point.validate({ x: 255, y: 123 }), false)
		assert.equal(Point.validate({ x: 55, y: 223 }), false)
		assert.equal(Point.validate({ x: -255, y: 123 }), false)

		// assert.equal(Point.validate('5, 3.00'), false)


		// assert.equal(Point.inputMapper('25.5, 123.5').toSqlString(), 'POINT(25.5, 123.5)')
		// assert.equal(Point.inputMapper('25.5,123.5').toSqlString(), 'POINT(25.5, 123.5)')
		// assert.equal(Point.inputMapper('25,123').toSqlString(), 'POINT(25, 123)')
		// assert.equal(Point.inputMapper('25,123.5').toSqlString(), 'POINT(25, 123.5)')

		// assert.equal(Point.inputMapper('25, 123').toSqlString(), 'POINT(25, 123)')
		// assert.equal(Point.inputMapper('POINT(25.5, 123)').toSqlString(), 'POINT(25.5, 123)')
		// assert.equal(Point.inputMapper('POINT(25.5, 123.5)').toSqlString(), 'POINT(25.5, 123.5)')
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
			plate_number: '123-AAA',
			enum: '123123'
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
		assert.throws(() => { obj2.validate() }, { message: `driver_review_status.last_name must be type: 'Str', not 'number' {"last_name":123}` })
		assert.throws(() => { obj2.validate(true) }, { message: `uid is required` })
	})


	it('JSON model', async () => {
		const obj = new DriverReviewStatus({ uid: 123, first_name: 'lova', email: '123@gg.mail', car_brand: '' })

		assert.throws(() => { obj.validate(true) }, {
			message: 'driver_review_status.first_name.length should be 5, now is 4'
		})
	})
})
