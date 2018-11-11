[![Codacy Badge](https://api.codacy.com/project/badge/Grade/a86fa5fa33cd4effb4ca5120d9e5ed67)](https://app.codacy.com/app/vivalalova0/pool-mysql?utm_source=github.com&utm_medium=referral&utm_content=vivalalova/pool-mysql&utm_campaign=Badge_Grade_Dashboard)

This is depend on [mysql](https://github.com/mysqljs/mysql)
which made for migrating to features
* connection pool
* connection writer/reader
* async/await
* model.query
* log print

### Installation

```bash
  npm i pool-mysql --save
```

### Usage

##### Settings

pool-mysql loads settings from process.env
There is a helpful package [dotenv](https://github.com/motdotla/dotenv)

```bash
SQL_HOST={{writer}}
#reader is optional
SQL_HOST_READER={{reader}}
SQL_USER={{user}}
SQL_PASSWORD={{passwd}}
SQL_TABLE={{table name}}
```

##### Query

Require `pool-mysql`

```js
const pool = reqiure('pool-mysql')

pool.query(sql, value, (err, data) => {

})
```

Create connection

```js
const connection = await pool.createConnection()

//callback query
connection.query(sql, values, (err,data) => {

})

//support async/await
try {
  const result = await connection.q(sql,value)
} catch(err) {
  console.log(err)
}
```

After model setting

```js
const Schema = require('pool-mysql').Schema

const Posts = class posts extends Schema {
  get columns() {
    return {
      id: Schema.Types.PK,
      user: require('./user') // one to one reference
      //or
      user2: {
        ref: require('./user'), // one to one reference
        column: 'user'
      }
    }
}


const User = class user extends Schema {
  get columns() {
    return {
      id: Schema.Types.PK,
      user: [require('./posts')] //one to many reference
    }
}

await Posts
      .SELECT()         //default to columns()
      .FROM()
      .WHERE({id: 3})    //or you can use .WHERE('id = ?',3)
      .POPULATE('user') //query reference
      .PRINT()            //print command, connection id and works on writer/reader
      .WRITER           //force query on writer
      .exec()

await Trips.
      SELECT(Trips.KEYS, Users.KEYS)                   //defined columns
      .FROM()
      .LEFTJOIN('user_info ON uid = trips.user_id')
      .WHERE('trip_id = ?', 12345)
      .AND('trip_id > 0')
      .LIMIT()
      .NESTTABLES()
      .MAP(result => {
        const trip = result.trips
        trip.user = result.user_info
        return trip
      })
      .exec()                                         //will return nested json
```

### log level

Print all

```js
pool.logger = 'all'
```

Print if error

```js
pool.logger = 'error'
```

Print nothing

```js
pool.logger = 'none'
```

### cache

```js
const redis = require('redis')
const bluebird = require('bluebird')
bluebird.promisifyAll(redis.RedisClient.prototype)
bluebird.promisifyAll(redis.Multi.prototype)

const client = redis.createClient({
  host: ...,
  port: ...,
  db: ...
})

pool.redisClient = Redis

//...

const connection = await pool.createConnection

await connection.q('SELECT id FROM user WHERE uid = ?', userID, {
  key: `api:user:id:${userID}`, //optional , default to queryString
  EX: process.env.NODE_ENV == 'production' ? 240 : 12, //default to 0 , it's required if need cache
  isJSON: true, //default to true
})

await connection.q('SELECT id FROM user WHERE uid = ?', userID, { EX: 60})
```