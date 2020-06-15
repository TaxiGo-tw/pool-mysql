const mysql = require('mysql')
const throwError = require('./throwError')

class Base {
	// eslint-disable-next-line no-unused-vars
	static validate(value) {
		return true
	}
}

class PK {
	static validate() {
		return true
	}
}

class Point {
	static get regex() {
		return /(\d+\.\d+)|(\d+)/g
	}

	static validate(value) {
		if (typeof value === 'object') {
			return Point.rangeValidator(value)
				&& parseFloat(value.x) == value.x
				&& parseFloat(value.y) == value.y
		} else if (typeof value === 'string') {
			const matched = value.match(Point.regex)
			return (matched && matched.length == 2)
		}

		return false
	}

	static inputMapper(value) {
		if (!Point.validate(value)) {
			throw 'invalid'
		}

		let x, y

		if (typeof value === 'string') {
			([x, y] = value.match(Point.regex))
		} else if (typeof value === 'object') {
			({ x, y } = value)
		} else {
			throwError('input mapper failed')
		}

		if (!Point.rangeValidator({ x, y })) {
			throwError('range invalid')
		}

		return mysql.raw(`POINT(${parseFloat(x)}, ${parseFloat(y)})`)
	}

	static rangeValidator({ x, y }) {
		const xx = Number(x)
		const yy = Number(y)

		if (xx != x || yy != y || xx < -180 || xx > 180 || yy < -180 || yy > 180) {
			return false
		}

		return true
	}
}

class ENUM {
	static cases(...cases) {
		const instance = new this()
		instance._cases = cases
		return instance
	}

	static validate() {
		return true
	}
}


class Str extends String {
	static validate(string) {
		return typeof string === 'string'
	}
}

class JSONString extends Str {

	static validate(str) {
		if (!super.validate(str)) {
			return false
		}


		try {
			if (!str) {
				return false
			}

			JSON.parse(str)
			return true
		} catch (e) {
			return false
		}
	}
}

class Email extends String {
	static validate(string) {
		if (!string) {
			return false
		}

		const lowerCased = string.toLowerCase()

		// eslint-disable-next-line no-control-regex
		const regex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/
		return (lowerCased.match(regex) == lowerCased)
	}
}

class URL extends Str {
	static validate(string) {
		if (!super.validate(string)) {
			return false
		}

		const lowerCased = string.toLowerCase()

		return lowerCased.match(/(^https?:\/\/)/) ? true : false
	}
}

class Num extends Number {
	static validate(number) {
		return !isNaN(number) && typeof number === 'number'
	}
}

class NumberString extends Str {
	static validate(string) {
		if (!super.validate(string)) {
			return false
		}

		return !isNaN(string) && Number(string) == string
	}
}

module.exports = {
	Base, // for extends
	PK,
	Point,
	ENUM,
	Num,
	Str,
	JSONString,
	NumberString,
	Email,
	URL
}
