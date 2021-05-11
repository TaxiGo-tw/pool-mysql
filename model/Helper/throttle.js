
// const throttle = (callback, milliseconds) => {
// 	let lastTime = new Date()
// 	let timer

// 	let latest
// 	console.log('start')
// 	return (...args) => {
// 		latest = args

// 		if (lastTime < new Date() - milliseconds) {
// 			callback(...latest)
// 		} else if (timer) {
// 			console.log('have timer')
// 		} else {
// 			timer = setTimeout(() => {
// 				callback(...latest)

// 				lastTime = new Date()
// 				// clearTimeout(timer)
// 			}, milliseconds)
// 		}
// 	}
// }
