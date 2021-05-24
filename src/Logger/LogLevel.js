module.exports = {
	all: (err, toPrint) => {
		if (err) {
			console.log(err)
		}
		console.log(toPrint)
	},
	error: (err, toPrint) => {
		if (!err) {
			return
		}
		console.log(err || toPrint)
	},
	none: (err, toPrint) => {

	}
}
