
const quering = {}
const queries = {}

module.exports = class Cache {
	static isQuerying(key) {
		return quering[key]
	}

	static start(key) {
		quering[key] = true
	}

	static end(key) {
		quering[key] = false
	}


	static async waiting(key) {
		if (!queries[key]) {
			queries[key] = []
		}

		return new Promise((reslove, reject) => {
			queries[key].push((err, results) => {
				if (err) {
					return reject(err)
				}
				reslove(results)
			})
		})
	}

	static pop(key, err, result) {
		const arr = queries[key] || []
		while (arr.length) {
			const waitingQueries = arr.shift()
			waitingQueries(err, result)
		}

		Cache.end(key)
	}
}
