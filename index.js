var mysql = require('mysql');

var pool = mysql.createPool({
  connectionLimit: process.env.CONNECTION_LIMIT || 50,
  host: process.env.SQL_HOST,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_TABLE,
  multipleStatements: true,
});

pool.query = (sql, values, callback) => {
  pool.getConnection((err, connection) => {
    if (err) {
      return callback(err, null)
    }

    if (callback) {
      //
    } else {
      callback = values
      values = undefined
    }

    connection.query(sql, values, (err, result) => {
      callback(err, result)
      connection.release()
    })
  })
}

pool.createConnection = () => {
  return new Promise((resolve, reject) => {
    pool.getConnection(function (err, connection) {
      if (err) {
        console.log(err)
        return reject(err)
      }
      resolve(connection)
    })
  })
}

module.exports = pool
