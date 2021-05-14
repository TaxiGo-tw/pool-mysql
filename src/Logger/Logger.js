const Event = require('../Event')
const LogLevel = require('./LogLevel')

class Logger {

	constructor() {
		this._logger = LogLevel.error

		// (err, toPrint)
		Event.on('log', this._logger)
	}

	current() {
		return this._logger
	}

	set(logLevel) {
		this._logger = logLevel
	}
}

module.exports = new Logger()
