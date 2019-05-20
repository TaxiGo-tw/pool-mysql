require('./Misc')
require('./Connection')
const LogLevel = require('./LogLevel')
const defaultOptions = require('./DefaultOptions')
const Connection = require('./Connection')
class Pool {
	constructor({ options, redisClient } = {}) {
		this.options = options || defaultOptions

		this.connectionPool = {
			using: {},
			waiting: []
		}

		this._logger = LogLevel.error
		this.redisClient = redisClient

		this.connectionID = 0

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

	getConnection(callback, retry = 0) {
		try {
			let connection = this.connectionPool.waiting.shift()

			//reuse
			if (connection) {
				this.connectionPool.using[connection.id] = connection
				return callback(undefined, connection)
			}

			const numberOfConnections = Object.keys(this.connectionPool.using).length + this.connectionPool.waiting.length

			if (numberOfConnections >= this.options.connectionLimit) {
				if (retry > 3) {
					const error = Error('pool-mysql failed: connection numbers limited (retry 3)')
					callback(error, null)
				} else if (retry <= 3) {
					setTimeout(() => {
						this.getConnection(callback, retry + 1)
					}, 300)
				}
				return
			}

			//create new one
			connection = new Connection(this)
			connection.id = ++this.connectionID

			this.connectionPool.using[connection.id] = connection

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

	async _recycle(connection) {
		delete this.connectionPool.using[connection.id]
		this.connectionPool.waiting.push(connection)
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
