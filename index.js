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

    connection.query(sql, values, (err, result) => {
      connection.release()
      callback(err, result)
    })
  })
}

module.exports = pool
