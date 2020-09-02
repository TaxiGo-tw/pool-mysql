const { isInherit, realType } = require('./Type')

require('color-name')

module.exports.find = async function ({ this: { connection, columns, constructor }, results, populates, print = false, Schema }) {

	//nest object ,  FK only
	if (typeof populates[0] === 'object') {
		const [populate] = populates
		const struct = { [constructor.name]: populate }
		const options = { T: constructor, print, connection }

		return await this.reducer(struct, options, async (FK, superValue, populate, options) => {
			if (!populate) {
				return superValue
			}

			const { print, connection } = options
			const populatedValue = FK.model.columns[populate]
			const isArray = populatedValue instanceof Array

			const { model, column } = FK
			const ids = superValue.map(r => r[column]) //my id
			console.log('ids', ids)

			const values = ids.length
				? await model.SELECT().FROM().WHERE(`${populate} IN (?)`, [ids]).PRINT(print).exec(connection)
				: []

			if (isArray) {
				superValue.forEach(sv => {
					sv[populate] = values.filter(v => v[column] == sv[column])
				})
			} else {
				superValue.forEach(sv => {
					const [value] = values.filter(v => v[column] == sv[column])
					sv[populate] = value
				})
			}

			return superValue
		}, results)
	}
	else if (populates instanceof Array) {
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
	}

	return results
}

module.exports.typeAndColumn = function (populateType) {
	let populated

	switch (true) {
		case populateType.ref && typeof populateType.ref === 'function':
			populated = populateType.ref
			break
		case populateType.type && typeof populateType.type === 'function':
			populated = populateType.type
			break
		case populateType && typeof populateType === 'function':
			populated = populateType
			break
		default:
			throw 'type error: check get columns() of model if defined correct'
	}

	if (populated && populated.name === 'FK') {
		return {
			isFK: true,
			refType: populated.model,
			refColumn: populated.column
		}
	} else if (populated) {
		return {
			refType: populated,
			refColumn: populateType.column
		}
	}

	return {
		refType: populated
	}
}

module.exports.reducer = async function (struct = {}, options, callback, initValue = []) {
	const _getFK = (T, firstKey) => {
		const obj = T.columns[firstKey]
		return obj instanceof Array
			? obj[0]
			: obj.type || obj.ref || obj
	}

	const { T, print, connection } = options

	let results
	for (const key in struct) {
		if (struct.hasOwnProperty(key)) {
			const element = struct[key]

			if (Object.keys(element)) {
				const [firstKey] = Object.keys(element)
				const FK = _getFK(T, firstKey)
				results = await callback(FK, initValue, firstKey, element, { print, connection })
				console.log(results)
				await this.reducer(element, { T: FK.model, print, connection }, callback, results)
			}
		}
	}
	return results
}
