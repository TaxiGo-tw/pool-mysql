function isInherit(type, pk) {
	return type == pk || type.prototype instanceof pk
}

function realType(type) {
	return type.type || type
}

function isRealColumn(column) {
	const type = realType(column)

	return type
		&& (type instanceof Array === false)
		&& typeof type !== 'object'
}


module.exports = {
	isInherit,
	realType,
	isRealColumn
}
