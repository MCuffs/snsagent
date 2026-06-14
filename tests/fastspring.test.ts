import assert from 'node:assert/strict'
import test from 'node:test'
import crypto from 'crypto'
import { POST } from '../app/api/fastspring/webhook/route.ts'
import { dbService } from '../lib/db-service.ts'

// Configure environment variable for testing
const MOCK_WEBHOOK_SECRET = 'test-secret-key-12345'
process.env.FASTSPRING_WEBHOOK_SECRET = MOCK_WEBHOOK_SECRET

test('FastSpring Webhook signature verification fails with invalid signature', async () => {
  const payload = {
    events: [
      {
        id: 'evt_1',
        type: 'subscription.activated',
        data: {
          account: {
            contact: {
              email: 'test@shuffla.io',
            },
          },
          product: 'shuffla-creator',
        },
      },
    ],
  }

  const rawBody = JSON.stringify(payload)
  
  // Construct request with invalid signature
  const request = new Request('http://localhost/api/fastspring/webhook', {
    method: 'POST',
    headers: {
      'x-fs-signature': 'invalid-signature-here',
      'content-type': 'application/json',
    },
    body: rawBody,
  })

  const response = await POST(request)
  assert.equal(response.status, 401)
  
  const resBody = await response.json()
  assert.equal(resBody.success, false)
  assert.equal(resBody.error, 'Invalid signature')
})

test('FastSpring Webhook handles order.completed and subscription.activated to upgrade plan', async () => {
  const testEmail = 'user@example.com'
  const payload = {
    events: [
      {
        id: 'evt_order',
        type: 'order.completed',
        data: {
          account: {
            contact: {
              email: testEmail,
            },
          },
          items: [
            {
              product: {
                product: 'shuffla-studio-plan',
              },
            },
          ],
        },
      },
    ],
  }

  const rawBody = JSON.stringify(payload)
  const hmac = crypto.createHmac('sha256', MOCK_WEBHOOK_SECRET)
  hmac.update(rawBody)
  const validSignature = hmac.digest('base64')

  // Mock DB calls
  const originalGetUserByEmail = dbService.getUserByEmail
  const originalUpdateUserPlan = dbService.updateUserPlan

  let updatedUserId = ''
  let updatedPlan = ''

  dbService.getUserByEmail = async (email: string) => {
    if (email === testEmail) {
      return {
        id: 'mock-user-123',
        email: testEmail,
        plan: 'FREE',
      } as any
    }
    return null
  }

  dbService.updateUserPlan = async (userId: string, plan: string) => {
    updatedUserId = userId
    updatedPlan = plan
    return {} as any
  }

  try {
    const request = new Request('http://localhost/api/fastspring/webhook', {
      method: 'POST',
      headers: {
        'x-fs-signature': validSignature,
        'content-type': 'application/json',
      },
      body: rawBody,
    })

    const response = await POST(request)
    assert.equal(response.status, 200)

    const resBody = await response.json()
    assert.equal(resBody.success, true)

    // Verify DB update was triggered with correct user and mapped plan (Studio -> UNLIMITED)
    assert.equal(updatedUserId, 'mock-user-123')
    assert.equal(updatedPlan, 'UNLIMITED')
  } finally {
    dbService.getUserByEmail = originalGetUserByEmail
    dbService.updateUserPlan = originalUpdateUserPlan
  }
})

test('FastSpring Webhook handles subscription.canceled to downgrade plan', async () => {
  const testEmail = 'user-cancel@example.com'
  const payload = {
    events: [
      {
        id: 'evt_cancel',
        type: 'subscription.canceled',
        data: {
          account: {
            contact: {
              email: testEmail,
            },
          },
          product: 'shuffla-creator',
        },
      },
    ],
  }

  const rawBody = JSON.stringify(payload)
  const hmac = crypto.createHmac('sha256', MOCK_WEBHOOK_SECRET)
  hmac.update(rawBody)
  const validSignature = hmac.digest('base64')

  // Mock DB calls
  const originalGetUserByEmail = dbService.getUserByEmail
  const originalUpdateUserPlan = dbService.updateUserPlan

  let updatedUserId = ''
  let updatedPlan = ''

  dbService.getUserByEmail = async (email: string) => {
    if (email === testEmail) {
      return {
        id: 'mock-user-456',
        email: testEmail,
        plan: 'PRO',
      } as any
    }
    return null
  }

  dbService.updateUserPlan = async (userId: string, plan: string) => {
    updatedUserId = userId
    updatedPlan = plan
    return {} as any
  }

  try {
    const request = new Request('http://localhost/api/fastspring/webhook', {
      method: 'POST',
      headers: {
        'x-fs-signature': validSignature,
        'content-type': 'application/json',
      },
      body: rawBody,
    })

    const response = await POST(request)
    assert.equal(response.status, 200)

    const resBody = await response.json()
    assert.equal(resBody.success, true)

    // Verify plan updated to FREE
    assert.equal(updatedUserId, 'mock-user-456')
    assert.equal(updatedPlan, 'FREE')
  } finally {
    dbService.getUserByEmail = originalGetUserByEmail
    dbService.updateUserPlan = originalUpdateUserPlan
  }
})
