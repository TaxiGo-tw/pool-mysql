require('./Misc')
require('./Connection')
const LogLevel = require('./LogLevel')
const defaultOptions = require('./DefaultOptions')
const Connection = require('./Connection')

const { EventEmitter } = require('events')

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

		this.event = new EventEmitter()

		console.log('pool-mysql writer host: ', this.options.writer.host)
		console.log('pool-mysql reader host: ', this.options.reader.host)
	}

	get numberOfConnections() {
		const amount = Object.keys(this.connectionPool.using).length + this.connectionPool.waiting.length

		if (amount != this._numberOfConnections) {
			this.event.emit('amount', amount)
			this._numberOfConnections = amount
		}

		return amount
	}

	set numberOfConnections(value) {
		this._numberOfConnections = value
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

	getConnection(callback, retry = 0) {
		try {
			const numberOfConnections = this.numberOfConnections

			//reuse
			let connection = this.connectionPool.waiting.shift()
			if (connection) {
				this.connectionPool.using[connection.id] = connection
				this.event.emit('get', connection)

				return callback(undefined, connection)
			}

			//connection limit
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

			connection.connect().then(() => {
				this.connectionPool.using[connection.id] = connection

				this.event.emit('create', connection)

				callback(undefined, connection)
			}).catch(err => {
				callback(err, undefined)
			})
		} catch (error) {
			callback(error, undefined)
		}
	}

	async _recycle(connection) {
		delete this.connectionPool.using[connection.id]
		this.connectionPool.waiting.push(connection)
		this.event.emit('release', connection)
	}

	query(sql, b, c) {
		this.createConnection().then(connection => {
			const callback = c || b

			const cb = (a, b, c) => {
				this._recycle(connection).then()
				callback(a, b, c)
			}

			if (c) {
				connection.query(sql, b, cb)
			} else {
				connection.query(sql, cb)
			}
		}).catch(c || b)
		return {}
	}

	release() { }
}

module.exports = new Pool()
