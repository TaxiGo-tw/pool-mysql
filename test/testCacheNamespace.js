const { assert, expect } = require('chai')
const pool = require('../src/Pool')

// 以不同 database 的邏輯 pool 驗證 Redis cache key 命名空間（DB-free，createPool 不連線）
const poolAlpha = pool.createPool({ options: { writer: { database: 'alpha' }, reader: { database: 'alpha' } } })
const poolBeta = pool.createPool({ options: { writer: { database: 'beta' }, reader: { database: 'beta' } } })
const poolAlpha2 = pool.createPool({ options: { writer: { database: 'alpha' }, reader: { database: 'alpha' } } })

describe('Redis cache key 命名空間（LT-29092）', () => {

	describe('cacheNamespace：穩定、依 DB 身分', () => {
		it('不同 database 的 pool → 不同命名空間', () => {
			expect(poolAlpha.cacheNamespace).to.not.equal(poolBeta.cacheNamespace)
		})

		it('相同設定 → 相同命名空間（穩定、可跨 process/restart 一致）', () => {
			expect(poolAlpha.cacheNamespace).to.equal(poolAlpha2.cacheNamespace)
		})

		it('格式為 pm:<12 hex>:', () => {
			expect(poolAlpha.cacheNamespace).to.match(/^pm:[0-9a-f]{12}:$/)
		})
	})

	describe('redisCacheKey：auto key 加命名空間、custom key 維持原樣', () => {
		it('auto key（無自帶 key，用 SQL 字串）→ 加上 pool 命名空間', () => {
			assert.strictEqual(poolAlpha.redisCacheKey(undefined, 'SELECT 1'), poolAlpha.cacheNamespace + 'SELECT 1')
		})

		it('auto key 跨不同 DB 的 pool → 不同 key（避免跨 pool/DB 撞快取）', () => {
			expect(poolAlpha.redisCacheKey(undefined, 'SELECT 1')).to.not.equal(poolBeta.redisCacheKey(undefined, 'SELECT 1'))
		})

		it('custom key → 維持原樣（呼叫端契約，與外部 Redis 存取共用同一 key）', () => {
			assert.strictEqual(poolAlpha.redisCacheKey('blocked_users:123', 'SELECT 1'), 'blocked_users:123')
		})

		it('custom key 跨不同 pool → 仍相同（刻意共用，維持新舊 code path 互通）', () => {
			assert.strictEqual(
				poolAlpha.redisCacheKey('blocked_users:123', 'SELECT x'),
				poolBeta.redisCacheKey('blocked_users:123', 'SELECT y')
			)
		})
	})
})
