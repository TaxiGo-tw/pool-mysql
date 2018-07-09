This is depend on [mysql](https://github.com/mysqljs/mysql)
which made for migrating to features
* connection pool
* connection writer/reader
* async/await
* model.query
* log print

### Installation

```js
  npm i pool-mysql --save
```

### Usage

Require pool-mysql

```js
  const pool = reqiure('pool-mysql')

  pool.query(sql, value, (err, data) => {

  })
```

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
      .WHERE({id:3})    //or you can use .WHERE('id = ?',3)
      .POPULATE('user') //query reference
      .PRINT            //print command, connection id and works on writer/reader
      .WRITER           //force query on writer
      .exec()
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