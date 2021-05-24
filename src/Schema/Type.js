module.exports.isInherit = (type, type2) => {
	return type == type2 || type.prototype instanceof type2
}

module.exports.realType = (type) => {
	return type.type || type
}

module.exports.isRealColumn = (column) => {
	const type = this.realType(column)

	return type
		&& (type instanceof Array === false)
		&& typeof type !== 'object'
}
