
const isQuering = {}
const waitingCallbacks = {}

module.exports = class Combine {
	static isQuerying(key) {
		return isQuering[key]
	}

	static bind(key) {
		isQuering[key] = true
	}

	static end(key) {
		delete isQuering[key]
	}

	static async waitPublish(key) {
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

	static publish(key, err, result) {
		const arr = waitingCallbacks[key] || []
		while (arr.length) {
			const callback = arr.shift()
			callback(err, result)
		}

		Combine.end(key)
	}
}
