const { isInherit, realType } = require('./Type')

module.exports.find = async function ({ this: { connection, columns, constructor }, results, populates, print = false, Schema }) {
	if (populates instanceof Array) {
		for (const populateColumn of populates) {
			const populateType = columns[populateColumn]

			if (populateType instanceof Array) {//coupons: [Coupons]
				const [type] = populateType

				const [tColumn] = Object.keys(type.columns)
					.filter(c => (type.columns[c].ref || type.columns[c]).name == constructor.name)

				const [PKColumn] = Object.keys(columns)
					.filter(column => isInherit(realType(columns[column]), Schema.Types.PK))


				const ids = results.map(result => result[PKColumn])
				const populated = await type.SELECT().FROM().WHERE(`${tColumn} in (${ids})`).PRINT(print).exec(connection)

				results.forEach(result => {
					result[populateColumn] = populated.filter(p => p[tColumn] == result[PKColumn])
				})
			} else {// coupon: Coupons
				const { refType, refColumn = populateColumn } = this.typeAndColumn(populateType)

				const ids = results.filter(result => result[refColumn]).map(result => result[refColumn])

				const [PKColumn] = Object.keys(refType.columns).filter(column => isInherit(realType(refType.columns[column]), Schema.Types.PK))

				const populated = await refType.SELECT().FROM().WHERE(`${PKColumn} IN (${ids})`).PRINT(print).exec(connection)

				results.forEach(result => {
					if (result[refColumn]) {
						const [value] = populated.filter(populate => result[refColumn] == populate[PKColumn])

						result[populateColumn] = value || result[refColumn]
					}
				})
			}
		}
	} else { //nest object

	}

	return results
}


module.exports.typeAndColumn = function typeAndColumn(populateType) {
	if (populateType.type && populateType.type.name === 'FK') {
		return {
			refType: populateType.type.model,
			refColumn: populateType.type.column
		}
	} else if (populateType.ref) {
		return {
			refType: populateType.ref || populateType,
			refColumn: populateType.column
		}
	}

	return {
		refType: populateType
	}
}
