

module.exports.mapper = function (result) {
	const r = result[this.constructor.name]
	for (const key in result) {
		if (key == this.constructor.name) {
			continue
		}
		r[key] = result[key]
	}
	return new this.constructor(r)
}
