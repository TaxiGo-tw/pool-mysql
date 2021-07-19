
//by callback回的key產生不重複的array
module.exports.distinct = (array, cb) => {
	const obj = array.reduce((a, b) => {
		const key = cb(b)

		if (!a[key]) {
			a[key] = b
		}

		return a
	}, {})

	return Object.values(obj)
}
