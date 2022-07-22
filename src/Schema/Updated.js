
module.exports.handler = function ({ results, filter, getFirst }) {
	if (results[1].affectedRows == 0 && results[2].length == 0) {
		return []
	}

	const updated = results.reverse()[0][0]
	let updatedResults = []

	for (const key in updated) {
		if (updated[key] == '') { //沒update到row, 不然至少有個 ','
			continue
		}

		const arr = typeof updated[key] === 'string'
			? updated[key].replace(/,$/, '').split(',')
			: [updated[key]]

		for (let i = 0; i < arr.length; i++) {
			if (!updatedResults[i]) {
				updatedResults[i] = {}
			}

			if (arr[i] === '{{NULL}}') {
				updatedResults[i][key] = undefined
			} else {
				updatedResults[i][key] = arr[i]
			}
		}
	}

	if (filter) {
		updatedResults = updatedResults.filter(filter)
	}

	if (getFirst) {
		return updatedResults[0]
	}

	return updatedResults
}
