
module.exports = {
	isString: (str) => {
		return typeof str === 'string'
	},
	isNUMBER: (number) => {
		return typeof number === 'number'
	},
	isJSONString: (str) => {
		try {
			if (!str) {
				throw 'empty'
			}

			JSON.parse(str)
			return true
		} catch (e) {
			return false
		}
	},
	isEmail: () => {

	}
}
