const throwError = (error, onErr) => {
	if (process.env.NODE_ENV === 'TESTING') {
		console.log(error)
	}

	switch (true) {
		case typeof onErr === 'string':
			throw Error(onErr)
		case typeof onErr === 'function':
			throw Error(onErr(error))
		case typeof error === 'string':
			throw Error(error)
		default:
			throw error
	}
}

module.exports = throwError
