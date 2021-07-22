/* for pipe */
module.exports.stringify = (op, sep, cl, indent) => {
	const through = require('through')

	indent = indent || 0
	if (op === false) {
		op = ''
		sep = '\n'
		cl = ''
	} else if (op == null) {

		op = '[\n'
		sep = ',\n'
		cl = '\n]\n'

	}

	let first = true
	let anyData = false

	const stream = through((data) => {
		anyData = true

		let json
		try {
			json = JSON.stringify(data, null, indent)
		} catch (err) {
			return stream.emit('error', err)
		}

		if (first) {
			first = false
			stream.queue(op + json)
		} else {
			stream.queue(sep + json)
		}
	}, (data) => {
		if (!anyData) {
			stream.queue(op)
		}

		stream.queue(cl)
		stream.queue(null)
	})

	return stream
}
