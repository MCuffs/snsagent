import assert from 'node:assert/strict'
import test from 'node:test'
import { dbService } from '../lib/db-service.ts'
import { checkCampaignCreationLimit, checkBrandCountLimit, hasWatermark } from '../lib/limits.ts'

test('test@test.com bypasses campaign creation, brand count limits, and watermarks', async () => {
  const originalGetUser = dbService.getUser
  const originalGetCampaigns = dbService.getCampaigns
  const originalGetBrands = dbService.getBrands

  try {
    // Mock user test@test.com on FREE plan
    dbService.getUser = async (userId: string) => {
      if (userId === 'test-user-id') {
        return {
          id: 'test-user-id',
          email: 'test@test.com',
          name: 'Test User',
          plan: 'FREE',
          accountStatus: 'active',
        } as any
      }
      return null
    }

    dbService.getCampaigns = async (userId: string) => {
      // Return 10 campaigns (standard FREE plan limit is 2)
      return Array(10).fill({ id: 'campaign-id', userId, createdAt: new Date() }) as any
    }

    dbService.getBrands = async (userId: string) => {
      // Return 5 brands (standard FREE plan limit is 1)
      return Array(5).fill({ id: 'brand-id', userId, websiteUrl: 'not_general' }) as any
    }

    // 1. checkCampaignCreationLimit
    const campaignLimit = await checkCampaignCreationLimit('test-user-id')
    assert.equal(campaignLimit.allowed, true)
    assert.equal(campaignLimit.limit, 999999)

    // 2. checkBrandCountLimit
    const brandLimit = await checkBrandCountLimit('test-user-id')
    assert.equal(brandLimit.allowed, true)
    assert.equal(brandLimit.limit, 999999)

    // 3. hasWatermark
    const watermark = await hasWatermark('test-user-id')
    assert.equal(watermark, false)

  } finally {
    // Restore original methods
    dbService.getUser = originalGetUser
    dbService.getCampaigns = originalGetCampaigns
    dbService.getBrands = originalGetBrands
  }
})
