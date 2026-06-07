/**
 * Rate Limiting Utility
 * 
 * In-memory sliding window rate limiter for API routes.
 * Note: In serverless environments (Vercel), this is per-instance and resets on cold starts.
 * For production-grade rate limiting, consider Vercel KV or Redis.
 */

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

interface RateLimitResult {
  limited: boolean
  remaining: number
  resetMs: number
}

const rateLimitCache = new Map<string, { timestamps: number[] }>()

export function checkRateLimit(
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

// Cleanup old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  const maxWindow = 5 * 60 * 1000 // 5 minutes
  
  for (const [key, entry] of rateLimitCache.entries()) {
    const hasRecent = entry.timestamps.some(ts => now - ts < maxWindow)
    if (!hasRecent) {
      rateLimitCache.delete(key)
    }
  }
}, 60000) // Run every minute

// Preset configurations
export const RATE_LIMIT_PRESETS = {
  // AI Generation: 20 requests per 10 minutes per user
  aiGeneration: { maxRequests: 20, windowMs: 10 * 60 * 1000 },
  
  // Campaign Creation: 10 requests per hour per user
  campaignCreation: { maxRequests: 10, windowMs: 60 * 60 * 1000 },
  
  // Upload: 10 requests per minute per user
  upload: { maxRequests: 10, windowMs: 60 * 1000 },
  
  // General API: 100 requests per 5 minutes per user
  generalApi: { maxRequests: 100, windowMs: 5 * 60 * 1000 }
}
