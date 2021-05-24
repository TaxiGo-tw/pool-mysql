module.exports = {
	all: (err, toPrint) => {
		console.log(err, toPrint)
	},
	error: (identity, err, toPrint) => {
		if (!err) {
			return
		}
		console.log(err, toPrint)
	},
	none: (identity, { err, toPrint }) => {

	}
}
