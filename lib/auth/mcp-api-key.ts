import { createHash, randomBytes, timingSafeEqual } from 'crypto'

export function createMcpApiKey() {
  const bytes = cryptoRandomHex(32)
  return `shfl_${bytes}`
}

export function hashMcpApiKey(key: string) {
  return createHash('sha256').update(key).digest('hex')
}

export function verifyMcpApiKey(key: string, hash: string) {
  const provided = Buffer.from(hashMcpApiKey(key), 'hex')
  const expected = Buffer.from(hash, 'hex')
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

function cryptoRandomHex(byteLength: number) {
  return randomBytes(byteLength).toString('hex')
}
