
### Usage

```
  npm i pool-mysql --save
```

```
  const pool = reqiure('pool-mysql')
```

```
  pool.query(sql, value, (err, data) => {

  })
```
### log level

Print all
```
	pool.logger = 'all'
```

Print only error sql command
```
	pool.logger = 'error'
```

Print nothing
```
	pool.logger = 'none'
```