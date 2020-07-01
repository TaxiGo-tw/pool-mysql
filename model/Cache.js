
const quering = {}
const queries = {}

const waiting = async (cacheKey) => {
	if (!queries[cacheKey]) {
		queries[cacheKey] = []
	}

	return new Promise((reslove, reject) => {
		queries[cacheKey].push((err, results) => {
			if (err) {
				return reject(err)
			}
			reslove(results)
		})
	})
}

const pop = (key, err, result) => {
	const arr = queries[key] || []
	while (arr.length) {
		const waitingQueries = arr.shift()
		waitingQueries(err, result)
	}
	quering[key] = false
}

module.exports = {
	quering,
	queries,
	waiting,
	pop
}
