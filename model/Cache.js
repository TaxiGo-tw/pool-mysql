
const isQuering = {}
const waitingCallbacks = {}

module.exports = class Cache {
	static isQuerying(key) {
		return isQuering[key]
	}

	static start(key) {
		isQuering[key] = true
	}

	static end(key) {
		isQuering[key] = false
	}

	static async waiting(key) {
		if (!waitingCallbacks[key]) {
			waitingCallbacks[key] = []
		}

		return new Promise((reslove, reject) => {
			waitingCallbacks[key].push((err, results) => {
				if (err) {
					return reject(err)
				}
				reslove(results)
			})
		})
	}

	static pop(key, err, result) {
		const arr = waitingCallbacks[key] || []
		while (arr.length) {
			const callback = arr.shift()
			callback(err, result)
		}

		Cache.end(key)
	}
}
