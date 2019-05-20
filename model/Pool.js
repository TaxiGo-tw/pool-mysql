require('./Misc')
require('./Connection')
const LogLevel = require('./LogLevel')
const defaultOptions = require('./DefaultOptions')
const Connection = require('./Connection')
class Pool {
	constructor({ options, redisClient } = {}) {
		this.options = options || defaultOptions

		this.connectionPool = {
			using: [],
			waiting: []
		}

		this._logger = LogLevel.error
		this.redisClient = redisClient

		console.log('pool-mysql writer host: ', this.options.writer.host)
		console.log('pool-mysql reader host: ', this.options.reader.host)
	}

	get Schema() {
		return require('./Schema')
	}

	get logger() {
		return this._logger
	}

	set logger(string) {
		switch (string) {
			case 'all':
				this._logger = LogLevel.all
				break
			case 'error':
				this._logger = LogLevel.error
				break
			default:
				this._logger = LogLevel.none
				break
		}
	}

	get redisClient() {
		return this._redisClient
	}

	set redisClient(newValue) {
		this._redisClient = newValue

		if (!this._redisClient) {
			return
		}

		if (!this._redisClient.getJSONAsync) {
			this._redisClient.getJSONAsync = async (...args) => {
				const result = await this.redisClient.getAsync(...args)
				return JSON.parse(result)
			}
		}

		if (!this._redisClient.setJSONAsync) {
			this._redisClient.setJSONAsync = async (...args) => {
				args[1] = JSON.stringify(args[1])
				return await this.redisClient.setAsync(...args)
			}
		}
	}

	getConnection(callback) {
		try {
			const connection = new Connection(this)

			connection.connect().then(() => {
				callback(undefined, connection)
			}).catch(err => {
				callback(err, undefined)
			})
		} catch (error) {
			callback(error, undefined)
		}
	}

	async createConnection() {
		return new Promise(async (resolve, reject) => {
			this.getConnection((err, connection) => {
				if (err) {
					return reject(err)
				}
				resolve(connection)
			})
		})
	}

	query(sql, values, callback) {
		this.createConnection().then(connection => {
			connection.query(sql, values, callback)
		})
		return {}
	}

	release() {

	}
}

module.exports = new Pool()
