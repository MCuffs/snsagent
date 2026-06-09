/**
 * Rate Limiting Utility
 * 
 * Supports Vercel KV / Upstash Redis REST API natively using a Lua script over fetch.
 * Falls back to local in-memory sliding window rate limiter in development/local environments.
 */

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

export interface RateLimitResult {
  limited: boolean
  remaining: number
  resetMs: number
}

const rateLimitCache = new Map<string, { timestamps: number[] }>()

function checkInMemoryRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const entry = rateLimitCache.get(key) || { timestamps: [] }
  
  // Remove expired timestamps
  const validTimestamps = entry.timestamps.filter(
    ts => now - ts < config.windowMs
  )
  
  if (validTimestamps.length >= config.maxRequests) {
    const oldestTimestamp = validTimestamps[0]
    const resetMs = oldestTimestamp + config.windowMs - now
    
    rateLimitCache.set(key, { timestamps: validTimestamps })
    
    return {
      limited: true,
      remaining: 0,
      resetMs
    }
  }
  
  validTimestamps.push(now)
  rateLimitCache.set(key, { timestamps: validTimestamps })
  
  return {
    limited: false,
    remaining: config.maxRequests - validTimestamps.length,
    resetMs: config.windowMs
  }
}

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN

  if (!url || !token) {
    return checkInMemoryRateLimit(key, config)
  }

  // Clean up URL if it doesn't end with /
  const baseUrl = url.endsWith('/') ? url : `${url}/`

  try {
    // Lua script executes atomically on Upstash/Vercel KV:
    // 1. Get current requests count. If >= limit, return count and remaining TTL.
    // 2. Otherwise increment count. If it's the first request (count == 1), set expiration.
    // 3. Return count and remaining TTL.
    const luaScript = `
      local current = redis.call('get', KEYS[1])
      if current and tonumber(current) >= tonumber(ARGV[1]) then
        return {tonumber(current), redis.call('pttl', KEYS[1])}
      end
      local val = redis.call('incr', KEYS[1])
      if tonumber(val) == 1 then
        redis.call('pexpire', KEYS[1], ARGV[2])
      end
      return {tonumber(val), redis.call('pttl', KEYS[1])}
    `

    const response = await fetch(`${baseUrl}eval`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        script: luaScript,
        numkeys: 1,
        keys: [key],
        args: [String(config.maxRequests), String(config.windowMs)],
      }),
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`KV REST API returned status ${response.status}`)
    }

    const data = await response.json() as { result?: [number, number] }
    if (data.result && Array.isArray(data.result)) {
      const [count, ttlMs] = data.result
      const limited = count > config.maxRequests
      return {
        limited,
        remaining: limited ? 0 : Math.max(0, config.maxRequests - count),
        resetMs: ttlMs > 0 ? ttlMs : config.windowMs,
      }
    }
  } catch (error) {
    console.error('[RateLimit] Vercel KV rate limit request failed; falling back to in-memory.', error)
  }

  return checkInMemoryRateLimit(key, config)
}

// Preset configurations
export const RATE_LIMIT_PRESETS = {
  // AI Generation: 20 requests per 10 minutes per user
  aiGeneration: { maxRequests: 20, windowMs: 10 * 60 * 1000 },
  
  // Campaign Creation: 10 requests per hour per user
  campaignCreation: { maxRequests: 10, windowMs: 60 * 60 * 1000 },
  
  // Upload: 10 requests per minute per user
  upload: { maxRequests: 10, windowMs: 60 * 1000 },
  
  // General API: 100 requests per 5 minutes per user
  generalApi: { maxRequests: 100, windowMs: 5 * 60 * 1000 },

  // Authentication: 10 requests per minute per IP
  auth: { maxRequests: 10, windowMs: 60 * 1000 },

  // Payments: 5 requests per minute per IP
  payment: { maxRequests: 5, windowMs: 60 * 1000 }
}
