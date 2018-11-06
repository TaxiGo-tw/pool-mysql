class PK {

}
class Point {
	constructor(x = 0, y = 0) {
		this.x = x
		this.y = y
	}
}

class ENUM {
	static cases(...cases) {
		const instance = new this()
		instance._cases = cases
		return instance
	}
}

module.exports = {
	PK,
	Point,
	ENUM
}