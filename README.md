
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

Print if error
```
	pool.logger = 'error'
```

Print nothing
```
	pool.logger = 'none'
```