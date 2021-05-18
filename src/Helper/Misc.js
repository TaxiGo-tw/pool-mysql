// copy & paste from
// https://stackoverflow.com/a/14172822/3152391

Object.defineProperty(global, '__stack', {
	get: function () {
		const orig = Error.prepareStackTrace
		Error.prepareStackTrace = function (_, stack) {
			return stack
		}
		const err = new Error
		Error.captureStackTrace(err, arguments.callee)
		const stack = err.stack
		Error.prepareStackTrace = orig
		return stack
	}
})

Object.defineProperty(global, '__line', {
	get: function () {
		// eslint-disable-next-line no-undef
		return __stack[1].getLineNumber()
	}
})

Object.defineProperty(global, '__function', {
	get: function () {
		// eslint-disable-next-line no-undef
		return __stack[1].getFunctionName()
	}
})
