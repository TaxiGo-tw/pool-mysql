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
	constructor(x = 0, y = 0) {
		this.x = x
		this.y = y
	}

	static validate() {
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

class JSONString extends String {

	static validate(str) {
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

class URL extends String {
	static validate(string) {
		if (!string) {
			return false
		}

		const lowerCased = string.toLowerCase()

		return lowerCased.match(/(^https?:\/\/)/) ? true : false
	}
}
class Str extends String {
	static validate(string) {
		return typeof string === 'string'
	}
}

class Num extends Number {
	static validate(number) {
		return typeof number === 'number'
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
	Email,
	URL
}
