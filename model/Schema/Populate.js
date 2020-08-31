const { isInherit, realType } = require('./Type')

module.exports.find = async function ({ results, populates, print, Schema }) {
	if (populates instanceof Array) {
		for (const column of populates) {
			const populateType = this.columns[column]
			if (populateType instanceof Array) {//coupons: [Coupons]
				const type = populateType[0]

				const tColumn = Object.keys(type.columns).filter(c => type.columns[c].name == this.constructor.name)[0]
				const PKColumn = Object.keys(this.columns).filter(column => isInherit(realType(this.columns[column]), Schema.Types.PK))[0]
				const ids = results.map(result => result[PKColumn])
				const populated = await type.SELECT().FROM().WHERE(`${tColumn} in (${ids})`).PRINT(print || false).exec(this._connection)

				results.forEach(result => {
					result[column] = populated.filter(p => p[tColumn] == result[PKColumn])
				})
			} else {// coupon: Coupons
				let ids
				let refType = populateType
				let refColumn = column

				if (results instanceof Array) {
					if (typeof populateType == 'object') {
						// {
						// 	ref: require('...')
						// 	column:...
						// }
						refColumn = populateType.column
						refType = populateType.ref
						ids = results.filter(result => result[refColumn]).map(result => result[refColumn])
					} else {
						ids = results.filter(result => result[refColumn]).map(result => result[refColumn])
					}

					if (!ids.length) {
						continue
					}
				} else if (results && results[refColumn]) {
					ids = [results[refColumn]]
					if (!ids) {
						continue
					}
				} else {
					continue
				}

				const PKColumn = Object.keys(refType.columns).filter(column => isInherit(realType(refType.columns[column]), Schema.Types.PK))[0]

				const populated = await refType.SELECT().FROM().WHERE(`${PKColumn} IN (${ids})`).PRINT(print || false).exec(this._connection)

				results.forEach(result => {
					if (result[refColumn]) {
						result[column] = populated.filter(populate => result[refColumn] == populate[PKColumn])[0] || result[refColumn]
					}
				})
			}
		}
	} else { //object nest

	}

	return results
}
