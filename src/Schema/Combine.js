
const isQuering = {}
const waitingCallbacks = {}

module.exports = class Combine {
	// if query is exists
	static isQuerying(key) {
		return isQuering[key]
	}

	// sign up query
	static bind(key) {
		isQuering[key] = true
	}

	// sign off query
	static end(key) {
		delete isQuering[key]
	}

	// waiting for someone query results
	static async subscribe(key) {
		if (!waitingCallbacks[key]) {
			waitingCallbacks[key] = []
		}

		return new Promise((resolve, reject) => {
			const publisher = (err, results) => {
				if (err) {
					return reject(err)
				}
				resolve(results)
			}

			waitingCallbacks[key].push(publisher)
		})
	}

	// offer results to other query which subscribed
	static publish(key, err, result) {
		const arr = waitingCallbacks[key] || []
		while (arr.length) {
			const callback = arr.shift()
			callback(err, result)
		}

		Combine.end(key)
	}
}
