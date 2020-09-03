const throwError = require('./throwError')

function length({ key, value, option }) {
	if (option instanceof Array || !option.length) {
		return
	}

	if (value === undefined || value === null) {
		return
	}

	const { length } = option

	//validate value length
	//ex: length: 3
	if (typeof length === 'number' && value.length != length) {
		throwError(`${this.constructor.name}.${key}.length should be ${length}, now is ${value.length}`)
	}
	//ex: length: { min:3 , max: 5 }
	else if (typeof length === 'object' && (value.length < length.min || value.length > length.max)) {
		throwError(`${this.constructor.name}.${key}.length should between ${length.min} and ${length.max}, now is ${value.length}`)
	}
}

// insert 時 required 都要有值
// update 時 只看required不能是null
function required({ key, value, option, isInsert }) {
	const { required } = option
	if (!required) {
		return
	}

	if (isInsert && (value === undefined || value === null)) {
		throwError(`${key} is required`)
	} else if (!isInsert && value === null) {
		throwError(`${key} is required`)
	}
}

function validate(params) {
	const object = new this.constructor(params)
	switch (this._q[0].type) {
		case 'INSERT':
			object.validate(true)
			break
		case 'UPDATE':
			object.validate()
			break
	}
}

module.exports = {
	validate,
	required,
	length
}
