const { isInherit, realType } = require('./Type')

module.exports.find = async function ({ this: { connection, columns, constructor }, results, populates, print = false, Schema }) {

	const [populate] = populates

	if (populate === undefined || !Object.keys(populate).length || !results.length) {
		return results
	}
	//nest object ,  FK only
	if (typeof populates[0] === 'object') {
		const [populate] = populates
		const struct = { [constructor.name]: populate }
		const options = { T: constructor, print, connection }

		return await this.reducer(struct, options, async (T, FK, results, populate, options, superValue) => {
			if (!populate || !superValue.length || !results.length) {
				return results
			}

			const { print, connection } = options
			const populatedValue = T.columns[populate]
			const isArray = populatedValue instanceof Array

			const { model, column } = FK

			// populate 虛擬欄位
			const FK_of_FK = _getFK(model, column)

			const currentColumn = FK_of_FK.name == 'FK' ? FK_of_FK.column : populate
			const ids = superValue.map(r => r[currentColumn])

			const values = ids.length
				? await model.SELECT().FROM().WHERE(`${column} IN (${ids})`).PRINT(print).exec(connection)
				: []

			let toRef = []

			if (isArray) {
				superValue.forEach(sv => {
					toRef = toRef.concat(values.filter(v => v[column] == sv[currentColumn]))
					sv[populate] = values.filter(v => v[column] == sv[currentColumn])
				})
			} else {
				superValue.forEach(sv => {
					toRef = toRef.concat(values.filter(v => v[column] == sv[currentColumn]))
					const [value] = values.filter(v => v[column] == sv[currentColumn])
					sv[populate] = value
				})
			}

			return {
				current: toRef,
				total: results
			}
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


const _getFK = (T, queryKey) => {
	if (!queryKey) return

	const obj = T.columns[queryKey]

	return obj instanceof Array
		? obj[0]
		: obj.type || obj.ref || obj
}

module.exports.reducer = async function (struct = {}, options, callback, initValue = [], superValue) {
	const { T, print, connection } = options

	let results

	for (const key in struct) {
		const element = struct[key]
		if (!Object.keys(element)) continue

		for (const queryKey of Object.keys(element)) {

			const FK = _getFK(T, queryKey)

			if (!FK) break

			const { current, total } = await callback(T, FK, initValue, queryKey, { print, connection }, superValue || initValue)

			results = total

			await this.reducer(element, { T: FK.model, print, connection }, callback, results, current)
		}
	}

	return results
}
