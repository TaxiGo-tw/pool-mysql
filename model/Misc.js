// copy & passte from
// https://stackoverflow.com/a/14172822/3152391

Object.defineProperty(global, '__stack', {
	get: function () {
		var orig = Error.prepareStackTrace
		Error.prepareStackTrace = function (_, stack) {
			return stack
		}
		var err = new Error
		Error.captureStackTrace(err, arguments.callee)
		var stack = err.stack
		Error.prepareStackTrace = orig
		return stack
	}
})

Object.defineProperty(global, '__line', {
	get: function () {
		return __stack[1].getLineNumber()
	}
})

Object.defineProperty(global, '__function', {
	get: function () {
		return __stack[1].getFunctionName()
	}
})
