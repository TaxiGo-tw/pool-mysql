const { isInherit, realType } = require('./Type')

module.exports.find = async function ({ this: { connection, columns, constructor }, results, populates, print = false, Schema }) {
	if (populates instanceof Array) {
		for (const populateColumn of populates) {
			const populateType = columns[populateColumn]

			if (populateType instanceof Array) {//coupons: [Coupons]
				const { refType, refColumn = populateColumn, isFK } = this.typeAndColumn({ type: populateType[0] })

				const [type, tColumn, PKColumn] = (() => {
					if (isFK) {
						return [refType, refColumn, refColumn]
					}

					const [type] = populateType
					return [
						type,
						Object.keys(type.columns).filter(c => (type.columns[c].ref || type.columns[c]).name == constructor.name)[0],
						Object.keys(columns).filter(column => isInherit(realType(columns[column]), Schema.Types.PK))[0]
					]
				})()

				const ids = results.map(result => result[PKColumn]).filter(r => r !== undefined)

				const populated = ids.length
					? await type.SELECT().FROM().WHERE(`${tColumn} in (${ids})`).PRINT(print).exec(connection)
					: []

				results.forEach(result => {
					result[populateColumn] = populated.filter(p => p[tColumn] == result[PKColumn])
				})
			} else {// coupon: Coupons
				const { refType, refColumn = populateColumn, isFK } = this.typeAndColumn(populateType)

				const PKColumn = isFK
					? refColumn
					: Object.keys(refType.columns).filter(column => isInherit(realType(refType.columns[column]), Schema.Types.PK))[0]

				const ids = results.filter(result => result[refColumn]).map(result => result[refColumn])

				const populated = ids.length
					? await refType.SELECT().FROM().WHERE(`${PKColumn} IN (${ids})`).PRINT(print).exec(connection)
					: []

				results.forEach(result => {
					if (result[refColumn]) {
						const [value] = populated.filter(populate => result[refColumn] == populate[PKColumn])
						result[populateColumn] = value
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
			isFK: true,
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
