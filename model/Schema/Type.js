function isInherit(type, type2) {
	return type == type2 || type.prototype instanceof type2
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
