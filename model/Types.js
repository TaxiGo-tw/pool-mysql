const mysql = require('mysql')
const throwError = require('./throwError')
const { connectionID } = require('./Pool')

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
				&& Point.rangeValidator({ x: matched[0], y: matched[1] })
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
			throwError(`map to POINT failed, input: ${value}`)
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

class Polygon {
	//POLYGON((121.528596788208 25.022269222,121.5256136639099 25.021092746,121.5290786639099 25.017816165,121.5313911890412 25.020237154,121.528596788208 25.022269222))

	static _isObjectArray(arr) {
		return arr instanceof Array
			&& arr.length == arr.filter(a => typeof a === 'object').length
	}

	static _isAllContentsHasValue(arr) {
		for (const { x, y } of arr) {
			if (x == undefined || y == undefined || x < -180 || x > 180 || y < -180 || y > 180) {
				return false
			}
		}

		//頭尾相連
		if (arr[0].x != arr[arr.length - 1].x || arr[0].y != arr[arr.length - 1].y) {
			return false
		}

		return true
	}

	// [[{x,y}...],[{x,y}...]]
	// '((x y,x y,x y),(x y,x y,x y))'
	// 'POLYGON((x y,x y,x y),(x y,x y,x y))'

	static validate(value) {
		switch (true) {
			case value instanceof Array:
				for (const arr of value) {
					const pass = Polygon._isObjectArray(arr) && Polygon._isAllContentsHasValue(arr)
					if (!pass) {
						return false
					}
				}
				return true
			case typeof value === 'string':
				return value.match(/[POLYGON]?\(\s*\(\s*([+-]?\d*\.\d+)\s+([+-]?\d*\.\d+)\s*(,\s*[+-]?\d*\.\d+\s+[+-]?\d*\.\d+)+\s*,\s*\1\s+\2\s*\)\s*\)/i) != null
			default:
				return false
		}
	}

	static inputMapper(value) {
		if (value instanceof Array) {
			const result = value.map(array => {
				const string = array.map(r => `${r.x} ${r.y}`).join(',')
				return `(${string})`
			}).join(',')

			return mysql.raw(`POLYGON(${result})`)
		} else if (typeof value === 'string') {
			const matched = value.match(/\(\s*\(\s*([+-]?\d*\.\d+)\s+([+-]?\d*\.\d+)\s*(,\s*[+-]?\d*\.\d+\s+[+-]?\d*\.\d+)+\s*,\s*\1\s+\2\s*\)\s*\)/i)
			if (matched) {
				return mysql.raw(`POLYGON${matched[0]}`)
			}
		}

		throwError(`map to polygon failed, input: ${value}`)
	}
}

//dynamic type
function EnumGenerator(...values) {
	//GenericType
	return class Enum {
		static get enum() {
			return values
		}

		static validate(value) {
			return Enum.enum.includes(value)
		}
	}
}

class Str extends String {
	static validate(string) {
		return typeof string === 'string'
	}
}

class JSONString extends Str {

	static validate(value) {
		try {
			if (typeof value === 'object') {
				return true
			}

			if (value === undefined || value === null) {
				return true
			}

			const parsed = JSON.parse(value)
			if (typeof parsed !== 'object') {
				return false
			}

			return true
		} catch (e) {
			return false
		}
	}

	static inputMapper(value) {
		if (typeof value === 'object') {
			return JSON.stringify(value)
		}

		return value
	}
}

class SQLSelectOnlyString extends Str {
	static async validate(string) {
		const pool = require('./Pool')
		const connection = await pool.createConnection()
		try {
			if (!string) {
				return false
			}
			if (typeof string !== 'string') {
				return false
			}
			const regex = /^(?=SELECT.*FROM)(?!.*(?:CREATE|DROP|UPDATE|INSERT|ALTER|DELETE|ATTACH|DETACH|;)).*$/i
			if (string.match(regex) != string) {
				return false
			}
			if (await connection.q(string)) {
				return true
			}
		} catch (e) {
			console.log(e)
			return false
		} finally {
			await connection.rollback()
			await connection.release()
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
		return !isNaN(number) && Number(number) == number
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

class UNIX_TIMESTAMP {
	static validate(value) {
		return new Date(value).toString() !== 'Invalid Date'
	}

	static inputMapper(value) {
		switch (typeof value) {
			case 'string':
				return new Date(value).getTime() / 1000
			case 'number':
				return value
			default:
				throwError(`invalid date input ${value}`)
		}
	}
}

class DateTime {
	static validate(value) {
		return new Date(value).toString() !== 'Invalid Date'
	}

	static inputMapper(value) {
		switch (typeof value) {
			case 'string':
				return new Date(value).toISOString().slice(0, 19).replace('T', ' ')
			case 'number':
				return new Date(value * 1000).toISOString().slice(0, 19).replace('T', ' ')
			default:
				throwError(`invalid date input ${value}`)
		}
	}
}

module.exports = {
	Base, // for extends
	PK,
	Point,
	Polygon,
	ENUM: EnumGenerator,
	Number: Num,
	String: Str,
	JSONString,
	SQLSelectOnlyString,
	NumberString,
	Email,
	URL,
	UNIX_TIMESTAMP,
	DateTime
}
