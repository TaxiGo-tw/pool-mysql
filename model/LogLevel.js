module.exports = {
	all: (err, toPrint) => {
		console.log(toPrint)
	},
	error: (err, toPrint) => {
		if (!err) {
			return
		}
		console.log(toPrint)
	},
	none: (err, toPrint) => {

	}
}
