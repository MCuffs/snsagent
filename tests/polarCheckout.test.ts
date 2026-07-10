import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createCheckoutSessionWithEmailFallback,
  PolarApiError,
} from '../lib/polar.ts'

const originalFetch = globalThis.fetch
const originalApiKey = process.env.POLAR_API_KEY

test.afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalApiKey === undefined) delete process.env.POLAR_API_KEY
  else process.env.POLAR_API_KEY = originalApiKey
})

test('Polar checkout retries without an account email when its domain is rejected', async () => {
  process.env.POLAR_API_KEY = 'test-key'
  const requestBodies: Array<Record<string, unknown>> = []
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
    if (requestBodies.length === 1) {
      return new Response(JSON.stringify({
        error: 'RequestValidationError',
        detail: [{
          loc: ['body', 'customer_email'],
          msg: 'example.invalid is not a valid email address: The domain does not send email.',
        }],
      }), { status: 422 })
    }
    return Response.json({ id: 'checkout-1', url: 'https://polar.sh/checkout/checkout-1' })
  }

  const checkout = await createCheckoutSessionWithEmailFallback({
    productId: 'product-1',
    customerEmail: 'user@example.invalid',
    successUrl: 'https://shuffla.io/youtube-automation?checkout=success',
    metadata: { userId: 'user-1', plan: 'YOUTUBE_PROMO' },
  })

  assert.equal(checkout.id, 'checkout-1')
  assert.equal(requestBodies.length, 2)
  assert.equal(requestBodies[0].customer_email, 'user@example.invalid')
  assert.equal('customer_email' in requestBodies[1], false)
  assert.deepEqual(requestBodies[1].metadata, { userId: 'user-1', plan: 'YOUTUBE_PROMO' })
})

test('Polar checkout does not retry unrelated API errors', async () => {
  process.env.POLAR_API_KEY = 'test-key'
  let requestCount = 0
  globalThis.fetch = async () => {
    requestCount += 1
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  await assert.rejects(
    createCheckoutSessionWithEmailFallback({
      productId: 'product-1',
      customerEmail: 'user@example.com',
      successUrl: 'https://shuffla.io/youtube-automation?checkout=success',
    }),
    (error: unknown) => error instanceof PolarApiError && error.status === 401,
  )
  assert.equal(requestCount, 1)
})
