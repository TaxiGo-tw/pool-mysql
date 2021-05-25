module.exports = {
	all: (err, toPrint) => {
		if (err) {
			err.toPrint = toPrint
			console.log(err)
		} else {
			console.log(toPrint)
		}
	},
	error: (err, toPrint) => {
		if (!err) {
			return
		}

		err.toPrint = toPrint
		console.log(err)
	},
	none: (err, toPrint) => {

	}
}
