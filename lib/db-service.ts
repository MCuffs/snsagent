import fs from 'fs'
import os from 'os'
import path from 'path'
import prisma from './db'
import { saveErrorLog } from './errorLogger'
import { getHistoryRetentionDays, getHistoryRetentionStatus } from './history-retention'

const DB_FILE_PATH = process.env.VERCEL
  ? path.join(os.tmpdir(), 'shuffla-db.json')
  : path.join(process.cwd(), 'prisma', 'db.json')

// Define TypeScript interfaces for our DB models
export interface User {
  id: string
  email: string
  name: string | null
  plan: string // FREE, PRO, UNLIMITED
  accountStatus: string // active, blocked
  polarSubscriptionId: string | null
  polarSubscriptionStatus: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Brand {
  id: string
  userId: string
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor: string
  forbiddenWords: string
  ctaStyle: string
  websiteUrl?: string | null
  brandDna?: string | null
  editorPreferences?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface InstagramAccount {
  id: string
  userId: string
  brandId: string
  instagramAccountId: string
  accessTokenEncrypted: string
  facebookPageId?: string | null
  pageAccessTokenEncrypted?: string | null
  tokenExpiresAt?: Date | null
  username?: string | null
  profilePictureUrl?: string | null
  connectionMethod?: string
  status: string // CONNECTED, DISCONNECTED
  createdAt: Date
  updatedAt: Date
}

export interface Campaign {
  id: string
  userId: string
  brandId: string
  title: string
  productName: string
  productDescription: string
  keyBenefits: string
  objective: string
  slideCount: number
  status: string // draft, generated, pending_approval, scheduled, posted, failed
  agentReport?: string | null
  imageModel: string | null
  initialImageCount: number
  regenerationImageCount: number
  lastRegenerationImageModel: string | null
  createdAt: Date
  updatedAt: Date
  slides?: CarouselSlide[]
}

export interface CampaignSummary {
  id: string
  title: string
  status: string
  createdAt: Date
  thumbnail: string | null
}

export interface CampaignUsageSummary {
  imageUsed: number
  videoUsed: number
  history: {
    id: string
    title: string
    mediaType: 'image' | 'video'
    createdAt: Date
    status: string
  }[]
}

export interface CarouselSlide {
  id: string
  campaignId: string
  slideNumber: number
  headline: string
  body: string
  designPrompt: string
  imageUrl: string | null
  backgroundImageUrl: string | null
  mediaType: string
  videoUrl: string | null
  videoThumbnailUrl: string | null
  videoStartSec: number | null
  videoDurationSec: number | null
  fontPreset: string | null
  textColor: string | null
  headlineFontSize: number | null
  bodyFontSize: number | null
  editorDocument: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Post {
  id: string
  campaignId: string
  userId: string
  brandId: string
  caption: string
  hashtags: string
  scheduledAt: Date
  instagramMediaId: string | null
  status: string // draft, pending_approval, scheduled, posted, failed
  createdAt: Date
  updatedAt: Date
}

export interface Template {
  id: string
  userId: string
  name: string
  document: string
  slideNumber: number | null
  thumbnail: string | null
  createdAt: Date
  updatedAt: Date
}

// Local mock database structure
interface MockDatabase {
  users: User[]
  brands: Brand[]
  instagramAccounts: InstagramAccount[]
  campaigns: Campaign[]
  slides: CarouselSlide[]
  posts: Post[]
  templates: Template[]
}

type StoredUser = Omit<User, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }
type StoredBrand = Omit<Brand, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }
type StoredInstagramAccount = Omit<InstagramAccount, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }
type StoredCampaign = Omit<Campaign, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }
type StoredCarouselSlide = Omit<CarouselSlide, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }
type StoredPost = Omit<Post, 'scheduledAt' | 'createdAt' | 'updatedAt'> & { scheduledAt: string; createdAt: string; updatedAt: string }
type StoredTemplate = Omit<Template, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }

interface StoredMockDatabase {
  users?: StoredUser[]
  brands?: StoredBrand[]
  instagramAccounts?: StoredInstagramAccount[]
  campaigns?: StoredCampaign[]
  slides?: StoredCarouselSlide[]
  posts?: StoredPost[]
  templates?: StoredTemplate[]
}

function hydrateCampaign(campaign: StoredCampaign | Campaign): Campaign {
  return {
    ...campaign,
    imageModel: campaign.imageModel ?? null,
    initialImageCount: campaign.initialImageCount ?? 0,
    regenerationImageCount: campaign.regenerationImageCount ?? 0,
    lastRegenerationImageModel: campaign.lastRegenerationImageModel ?? null,
    createdAt: new Date(campaign.createdAt),
    updatedAt: new Date(campaign.updatedAt),
  }
}

function hydrateUser(user: StoredUser | User): User {
  return {
    ...user,
    accountStatus: (user as User).accountStatus ?? 'active',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    polarSubscriptionId: (user as any).polarSubscriptionId ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    polarSubscriptionStatus: (user as any).polarSubscriptionStatus ?? null,
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
  }
}

function hydrateSlide(slide: StoredCarouselSlide | CarouselSlide): CarouselSlide {
  return {
    ...slide,
    backgroundImageUrl: slide.backgroundImageUrl ?? null,
    mediaType: slide.mediaType === 'video' ? 'video' : 'image',
    videoUrl: slide.videoUrl ?? null,
    videoThumbnailUrl: slide.videoThumbnailUrl ?? null,
    videoStartSec: slide.videoStartSec ?? null,
    videoDurationSec: slide.videoDurationSec ?? null,
    fontPreset: slide.fontPreset ?? null,
    textColor: slide.textColor ?? null,
    headlineFontSize: slide.headlineFontSize ?? null,
    bodyFontSize: slide.bodyFontSize ?? null,
    editorDocument: slide.editorDocument ?? null,
    createdAt: new Date(slide.createdAt),
    updatedAt: new Date(slide.updatedAt),
  }
}

function initMockDb(): MockDatabase {
  if (!fs.existsSync(path.dirname(DB_FILE_PATH))) {
    fs.mkdirSync(path.dirname(DB_FILE_PATH), { recursive: true })
  }
  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const content = fs.readFileSync(DB_FILE_PATH, 'utf8')
      const parsed = JSON.parse(content) as StoredMockDatabase
      // Convert dates back to Date objects
      return {
        users: (parsed.users || []).map(hydrateUser),
        brands: (parsed.brands || []).map((b) => ({ ...b, createdAt: new Date(b.createdAt), updatedAt: new Date(b.updatedAt) })),
        instagramAccounts: (parsed.instagramAccounts || []).map((ia) => ({ ...ia, tokenExpiresAt: ia.tokenExpiresAt ? new Date(ia.tokenExpiresAt) : null, createdAt: new Date(ia.createdAt), updatedAt: new Date(ia.updatedAt) })),
        campaigns: (parsed.campaigns || []).map(hydrateCampaign),
        slides: (parsed.slides || []).map(hydrateSlide),
        posts: (parsed.posts || []).map((p) => ({ ...p, scheduledAt: new Date(p.scheduledAt), createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) })),
        templates: (parsed.templates || []).map((t) => ({ ...t, createdAt: new Date(t.createdAt), updatedAt: new Date(t.updatedAt) })),
      }
    } catch (e) {
      console.error('Failed to parse mock database, initializing new database', e)
    }
  }

  const defaultDb: MockDatabase = {
    users: [],
    brands: [],
    instagramAccounts: [],
    campaigns: [],
    slides: [],
    posts: [],
    templates: [],
  }
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(defaultDb, null, 2), 'utf8')
  return defaultDb
}

function writeMockDb(db: MockDatabase) {
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf8')
}

// Enforce fail-closed database policy in production
if (process.env.NODE_ENV === 'production' && process.env.DATABASE_MOCK_FALLBACK !== 'true') {
  process.env.DATABASE_MOCK_FALLBACK = 'false'
}

// Check if we should use Prisma database or Local Mock file database
const isMock = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.DATABASE_MOCK_FALLBACK === 'true'
  }
  return process.env.DATABASE_MOCK_FALLBACK === 'true' || !process.env.DATABASE_URL
}

export const dbService = {
  // Health check for uptime monitoring
  async healthCheck(): Promise<void> {
    if (!isMock()) {
      await prisma.$queryRaw`SELECT 1`
    }
  },

  // User operations
  async getUser(userId: string): Promise<User | null> {
    if (userId.startsWith('u-')) {
      const db = initMockDb()
      return db.users.find(u => u.id === userId) || null
    }

    if (!isMock()) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
        })
        if (user) return user as unknown as User
      } catch (err) {
        console.warn('Prisma getUser failed, falling back to mock database', err)
        await saveErrorLog(userId, 'getUser', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    return db.users.find(u => u.id === userId) || null
  },

  async getUserByEmail(email: string): Promise<User | null> {
    if (!isMock()) {
      try {
        return await prisma.user.findUnique({
          where: { email },
        }) as unknown as User
      } catch (err) {
        console.warn('Prisma getUserByEmail failed, falling back to mock database', err)
        await saveErrorLog(null, 'getUserByEmail', err, { email })
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    return db.users.find(u => u.email === email) || null
  },

  async getOrCreateUser(email: string, name?: string): Promise<User> {
    if (!isMock()) {
      try {
        const user = await prisma.user.upsert({
          where: { email },
          update: { name },
          create: { email, name, plan: 'FREE' },
        })
        return user as unknown as User
      } catch (err) {
        console.warn('Prisma getOrCreateUser failed, falling back to mock database', err)
        await saveErrorLog(null, 'getOrCreateUser', err, { email })
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    let user = db.users.find(u => u.email === email)
    if (!user) {
      user = {
        id: `u-${Date.now()}`,
        email,
        name: name || email.split('@')[0],
        plan: 'FREE',
        accountStatus: 'active',
        polarSubscriptionId: null,
        polarSubscriptionStatus: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db.users.push(user as any)
      writeMockDb(db)
    }
    return user!
  },

  async createUserWithPassword(email: string, passwordHash: string, name?: string): Promise<User> {
    if (!isMock()) {
      try {
        return await prisma.user.create({
          data: { email, name, passwordHash, plan: 'FREE' },
        }) as unknown as User
      } catch (err) {
        console.warn('Prisma createUserWithPassword failed', err)
        await saveErrorLog(null, 'createUserWithPassword', err, { email })
        throw err
      }
    }
    const db = initMockDb()
    const user = {
      id: `u-${Date.now()}`,
      email,
      name: name || email.split('@')[0],
      plan: 'FREE',
      accountStatus: 'active',
      passwordHash,
      polarSubscriptionId: null,
      polarSubscriptionStatus: null,
      brandDna: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db.users.push(user as any)
    return hydrateUser(user as unknown as StoredUser)
  },

  async updateUserPlan(userId: string, plan: string): Promise<User> {
    if (!isMock()) {
      try {
        return await prisma.user.update({
          where: { id: userId },
          data: { plan },
        }) as unknown as User
      } catch (err) {
        console.warn('Prisma updateUserPlan failed, falling back to mock database', err)
        await saveErrorLog(userId, 'updateUserPlan', err, { plan })
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    const userIndex = db.users.findIndex(u => u.id === userId)
    if (userIndex !== -1) {
      db.users[userIndex].plan = plan
      db.users[userIndex].updatedAt = new Date()
      writeMockDb(db)
      return db.users[userIndex]
    }
    throw new Error('User not found')
  },

  async updateUserPolar(userId: string, data: {
    polarSubscriptionId?: string | null
    polarSubscriptionStatus?: string | null
    plan?: string
  }): Promise<void> {
    if (!isMock()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma.user as any).update({ where: { id: userId }, data })
    } else {
      const db = initMockDb()
      const idx = db.users.findIndex(u => u.id === userId)
      if (idx !== -1) {
        if (data.plan !== undefined) db.users[idx].plan = data.plan
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (data.polarSubscriptionId !== undefined) (db.users[idx] as any).polarSubscriptionId = data.polarSubscriptionId
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (data.polarSubscriptionStatus !== undefined) (db.users[idx] as any).polarSubscriptionStatus = data.polarSubscriptionStatus
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(db.users[idx] as any).updatedAt = new Date().toISOString()
        writeMockDb(db)
      }
    }
  },

  async getUserByPolarSubscriptionId(polarSubscriptionId: string): Promise<User | null> {
    if (!isMock()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (prisma.user as any).findUnique({ where: { polarSubscriptionId } }) as unknown as Promise<User | null>
    }
    const db = initMockDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (db.users.find((u: any) => u.polarSubscriptionId === polarSubscriptionId) || null) as User | null
  },

  // Brand operations
  async getBrands(userId: string): Promise<Brand[]> {
    if (!isMock()) {
      try {
        return await prisma.brand.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        })
      } catch (err) {
        console.warn('Prisma getBrands failed, falling back to mock database', err)
        await saveErrorLog(userId, 'getBrands', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    return db.brands.filter(b => b.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  },

  async getBrand(brandId: string): Promise<Brand | null> {
    if (brandId.startsWith('b-')) {
      const db = initMockDb()
      return db.brands.find(b => b.id === brandId) || null
    }

    if (!isMock()) {
      try {
        const brand = await prisma.brand.findUnique({
          where: { id: brandId },
        })
        if (brand) return brand
      } catch (err) {
        console.warn('Prisma getBrand failed, falling back to mock database', err)
        await saveErrorLog(null, 'getBrand', err, { brandId })
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    return db.brands.find(b => b.id === brandId) || null
  },

  async getSlide(slideId: string): Promise<(CarouselSlide & { campaign: Campaign }) | null> {
    if (slideId.startsWith('s-') || slideId.startsWith('media-')) {
      const db = initMockDb()
      const slide = db.slides.find(s => s.id === slideId)
      if (!slide) return null

      const campaign = db.campaigns.find(c => c.id === slide.campaignId)
      if (!campaign) return null

      return {
        ...slide,
        campaign,
      }
    }

    if (!isMock()) {
      try {
        const slide = await prisma.carouselSlide.findUnique({
          where: { id: slideId },
          include: { campaign: true },
        })
        if (slide) return slide
      } catch (err) {
        console.warn('Prisma getSlide failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    const slide = db.slides.find(s => s.id === slideId)
    if (!slide) return null

    const campaign = db.campaigns.find(c => c.id === slide.campaignId)
    if (!campaign) return null

    return {
      ...slide,
      campaign,
    }
  },

  async saveBrand(userId: string, brandId: string | null, data: Omit<Brand, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Brand> {
    if (!isMock()) {
      try {
        let exists = false
        if (brandId && !brandId.startsWith('b-')) {
          const count = await prisma.brand.count({
            where: { id: brandId },
          })
          exists = count > 0
        }

        if (brandId && exists) {
          return await prisma.brand.update({
            where: { id: brandId },
            data,
          })
        } else {
          return await prisma.brand.create({
            data: {
              ...data,
              userId,
            },
          })
        }
      } catch (err) {
        console.warn('Prisma saveBrand failed, falling back to mock database', err)
        await saveErrorLog(userId, 'saveBrand', err, { brandId, ...data })
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    let brand: Brand
    if (brandId) {
      const idx = db.brands.findIndex(b => b.id === brandId)
      if (idx !== -1) {
        brand = {
          ...db.brands[idx],
          ...data,
          updatedAt: new Date(),
        }
        db.brands[idx] = brand
      } else {
        // ID not found in DB — create new brand (upsert fallback)
        brand = {
          id: `b-${Date.now()}`,
          userId,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        db.brands.push(brand)
      }
    } else {
      brand = {
        id: `b-${Date.now()}`,
        userId,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      db.brands.push(brand)
    }
    writeMockDb(db)
    return brand
  },

  async updateBrandEditorPreferences(brandId: string, editorPreferences: string): Promise<void> {
    if (!isMock()) {
      await prisma.brand.update({ where: { id: brandId }, data: { editorPreferences } })
      return
    }

    const db = initMockDb()
    const brand = db.brands.find(item => item.id === brandId)
    if (brand) {
      brand.editorPreferences = editorPreferences
      brand.updatedAt = new Date()
      writeMockDb(db)
    }
  },

  // Instagram operations
  async getInstagramAccount(userId: string, brandId: string): Promise<InstagramAccount | null> {
    if (brandId.startsWith('b-') || userId.startsWith('u-')) {
      const db = initMockDb()
      return db.instagramAccounts.find(ia => ia.brandId === brandId) || null
    }

    if (!isMock()) {
      try {
        const account = await prisma.instagramAccount.findUnique({
          where: { brandId }, // unique index
        })
        if (account) return account
      } catch (err) {
        console.warn('Prisma getInstagramAccount failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    return db.instagramAccounts.find(ia => ia.brandId === brandId) || null
  },

  async disconnectInstagramAccount(userId: string, brandId: string): Promise<void> {
    if (!isMock()) {
      try {
        await prisma.instagramAccount.deleteMany({
          where: { userId, brandId },
        })
        return
      } catch (err) {
        console.warn('Prisma disconnectInstagramAccount failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    db.instagramAccounts = db.instagramAccounts.filter(ia => !(ia.userId === userId && ia.brandId === brandId))
    writeMockDb(db)
  },

  async saveInstagramAccount(userId: string, brandId: string, instagramAccountId: string, accessTokenEncrypted: string): Promise<InstagramAccount> {
    if (!isMock()) {
      try {
        return await prisma.instagramAccount.upsert({
          where: { brandId },
          update: {
            instagramAccountId,
            accessTokenEncrypted,
            connectionMethod: 'manual',
            status: 'CONNECTED',
          },
          create: {
            userId,
            brandId,
            instagramAccountId,
            accessTokenEncrypted,
            connectionMethod: 'manual',
            status: 'CONNECTED',
          },
        })
      } catch (err) {
        console.warn('Prisma saveInstagramAccount failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    let acc = db.instagramAccounts.find(ia => ia.brandId === brandId)
    if (acc) {
      acc.instagramAccountId = instagramAccountId
      acc.accessTokenEncrypted = accessTokenEncrypted
      acc.connectionMethod = 'manual'
      acc.status = 'CONNECTED'
      acc.updatedAt = new Date()
    } else {
      acc = {
        id: `ia-${Date.now()}`,
        userId,
        brandId,
        instagramAccountId,
        accessTokenEncrypted,
        connectionMethod: 'manual',
        status: 'CONNECTED',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      db.instagramAccounts.push(acc)
    }
    writeMockDb(db)
    return acc
  },

  async saveInstagramOAuthAccount(
    userId: string,
    brandId: string,
    data: {
      instagramAccountId: string
      accessTokenEncrypted: string
      facebookPageId: string
      pageAccessTokenEncrypted: string
      tokenExpiresAt: Date | null
      username?: string | null
      profilePictureUrl?: string | null
      connectionMethod: 'oauth'
    }
  ): Promise<InstagramAccount> {
    if (!isMock()) {
      try {
        return await prisma.instagramAccount.upsert({
          where: { brandId },
          update: {
            instagramAccountId: data.instagramAccountId,
            accessTokenEncrypted: data.accessTokenEncrypted,
            facebookPageId: data.facebookPageId,
            pageAccessTokenEncrypted: data.pageAccessTokenEncrypted,
            tokenExpiresAt: data.tokenExpiresAt,
            username: data.username,
            profilePictureUrl: data.profilePictureUrl,
            connectionMethod: data.connectionMethod,
            status: 'CONNECTED',
          },
          create: {
            userId,
            brandId,
            instagramAccountId: data.instagramAccountId,
            accessTokenEncrypted: data.accessTokenEncrypted,
            facebookPageId: data.facebookPageId,
            pageAccessTokenEncrypted: data.pageAccessTokenEncrypted,
            tokenExpiresAt: data.tokenExpiresAt,
            username: data.username,
            profilePictureUrl: data.profilePictureUrl,
            connectionMethod: data.connectionMethod,
            status: 'CONNECTED',
          },
        })
      } catch (err) {
        console.warn('Prisma saveInstagramOAuthAccount failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    let acc = db.instagramAccounts.find(ia => ia.brandId === brandId)
    if (acc) {
      acc.instagramAccountId = data.instagramAccountId
      acc.accessTokenEncrypted = data.accessTokenEncrypted
      acc.facebookPageId = data.facebookPageId
      acc.pageAccessTokenEncrypted = data.pageAccessTokenEncrypted
      acc.tokenExpiresAt = data.tokenExpiresAt
      acc.username = data.username
      acc.profilePictureUrl = data.profilePictureUrl
      acc.connectionMethod = data.connectionMethod
      acc.status = 'CONNECTED'
      acc.updatedAt = new Date()
    } else {
      acc = {
        id: `ia-${Date.now()}`,
        userId,
        brandId,
        instagramAccountId: data.instagramAccountId,
        accessTokenEncrypted: data.accessTokenEncrypted,
        facebookPageId: data.facebookPageId,
        pageAccessTokenEncrypted: data.pageAccessTokenEncrypted,
        tokenExpiresAt: data.tokenExpiresAt,
        username: data.username,
        profilePictureUrl: data.profilePictureUrl,
        connectionMethod: data.connectionMethod,
        status: 'CONNECTED',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      db.instagramAccounts.push(acc)
    }
    writeMockDb(db)
    return acc
  },

  // Campaign operations
  async createCampaign(
    userId: string,
    brandId: string,
    campaignData: {
      title: string
      productName: string
      productDescription: string
      keyBenefits: string
      objective: string
      slideCount: number
      agentReport?: string | null
      imageModel?: string | null
      initialImageCount?: number
      mediaType?: string | null
    },
    slides: {
      slideNumber: number
      headline: string
      body: string
      designPrompt: string
      imageUrl?: string | null
      backgroundImageUrl?: string | null
      mediaType?: 'image' | 'video'
      videoUrl?: string | null
      videoThumbnailUrl?: string | null
      videoStartSec?: number | null
      videoDurationSec?: number | null
      fontPreset?: string | null
      textColor?: string | null
      headlineFontSize?: number | null
      bodyFontSize?: number | null
      editorDocument?: string | null
    }[]
  ): Promise<Campaign> {
    if (!isMock()) {
      try {
        const campaign = await prisma.campaign.create({
          data: {
            userId,
            brandId,
            ...campaignData,
            status: 'generated',
            slides: {
              create: slides.map(s => ({
                slideNumber: s.slideNumber,
                headline: s.headline,
                body: s.body,
                designPrompt: s.designPrompt,
                imageUrl: s.imageUrl || null,
                backgroundImageUrl: s.backgroundImageUrl || null,
                mediaType: s.mediaType ?? 'image',
                videoUrl: s.videoUrl ?? null,
                videoThumbnailUrl: s.videoThumbnailUrl ?? null,
                videoStartSec: s.videoStartSec ?? null,
                videoDurationSec: s.videoDurationSec ?? null,
                fontPreset: s.fontPreset || null,
                textColor: s.textColor || null,
                headlineFontSize: s.headlineFontSize ?? null,
                bodyFontSize: s.bodyFontSize ?? null,
                editorDocument: s.editorDocument ?? null,
              })),
            },
          },
          include: {
            slides: true,
          },
        })
        return campaign
      } catch (err) {
        console.warn('Prisma createCampaign failed, falling back to mock database', err)
        await saveErrorLog(userId, 'createCampaign', err, { brandId, ...campaignData })
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    const campaignId = `c-${Date.now()}`
    const campaign: Campaign = {
      id: campaignId,
      userId,
      brandId,
      ...campaignData,
      status: 'generated',
      imageModel: campaignData.imageModel ?? null,
      initialImageCount: campaignData.initialImageCount ?? 0,
      regenerationImageCount: 0,
      lastRegenerationImageModel: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const createdSlides: CarouselSlide[] = slides.map(s => ({
      id: `s-${Date.now()}-${s.slideNumber}`,
      campaignId,
      slideNumber: s.slideNumber,
      headline: s.headline,
      body: s.body,
      designPrompt: s.designPrompt,
      imageUrl: s.imageUrl || null,
      backgroundImageUrl: s.backgroundImageUrl || null,
      mediaType: s.mediaType ?? 'image',
      videoUrl: s.videoUrl ?? null,
      videoThumbnailUrl: s.videoThumbnailUrl ?? null,
      videoStartSec: s.videoStartSec ?? null,
      videoDurationSec: s.videoDurationSec ?? null,
      fontPreset: s.fontPreset || null,
      textColor: s.textColor || null,
      headlineFontSize: s.headlineFontSize ?? null,
      bodyFontSize: s.bodyFontSize ?? null,
      editorDocument: s.editorDocument ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

    db.campaigns.push(campaign)
    db.slides.push(...createdSlides)
    writeMockDb(db)

    return {
      ...campaign,
      slides: createdSlides,
    }
  },

  async getCampaign(campaignId: string): Promise<(Campaign & { slides: CarouselSlide[] }) | null> {
    if (campaignId.startsWith('c-')) {
      const db = initMockDb()
      const campaign = db.campaigns.find(c => c.id === campaignId)
      if (!campaign) return null

      const slides = db.slides
        .filter(s => s.campaignId === campaignId)
        .sort((a, b) => a.slideNumber - b.slideNumber)

      return {
        ...campaign,
        slides,
      }
    }

    if (!isMock()) {
      try {
        const c = await prisma.campaign.findUnique({
          where: { id: campaignId },
          include: { slides: { orderBy: { slideNumber: 'asc' } } },
        })
        if (c) return c
      } catch (err) {
        console.warn('Prisma getCampaign failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    const campaign = db.campaigns.find(c => c.id === campaignId)
    if (!campaign) return null

    const slides = db.slides
      .filter(s => s.campaignId === campaignId)
      .sort((a, b) => a.slideNumber - b.slideNumber)

    return {
      ...campaign,
      slides,
    }
  },

  async getCampaigns(userId: string): Promise<Campaign[]> {
    if (!isMock()) {
      try {
        return await prisma.campaign.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          include: { slides: true },
        })
      } catch (err) {
        console.warn('Prisma getCampaigns failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    const campaigns = db.campaigns.filter(c => c.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return campaigns.map(c => ({
      ...c,
      slides: db.slides.filter(s => s.campaignId === c.id).sort((a, b) => a.slideNumber - b.slideNumber),
    }))
  },

  async getCampaignSummaries(userId: string): Promise<CampaignSummary[]> {
    if (!isMock()) {
      try {
        const campaigns = await prisma.campaign.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            slides: {
              orderBy: { slideNumber: 'asc' },
              take: 1,
              select: { imageUrl: true },
            },
          },
        })
        return campaigns.map(campaign => ({
          id: campaign.id,
          title: campaign.title,
          status: campaign.status,
          createdAt: campaign.createdAt,
          thumbnail: campaign.slides[0]?.imageUrl ?? null,
        }))
      } catch (err) {
        console.warn('Prisma getCampaignSummaries failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    return db.campaigns
      .filter(campaign => campaign.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(campaign => ({
        id: campaign.id,
        title: campaign.title,
        status: campaign.status,
        createdAt: campaign.createdAt,
        thumbnail: db.slides
          .filter(slide => slide.campaignId === campaign.id)
          .sort((a, b) => a.slideNumber - b.slideNumber)[0]?.imageUrl ?? null,
      }))
  },

  async getCampaignUsageSummary(userId: string, periodStart: Date | null, historyLimit = 30): Promise<CampaignUsageSummary> {
    if (!isMock()) {
      try {
        const periodWhere = {
          userId,
          ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
        }

        const historyPromise = historyLimit > 0
          ? prisma.campaign.findMany({
              where: { userId },
              orderBy: { createdAt: 'desc' },
              take: historyLimit,
              select: {
                id: true,
                title: true,
                mediaType: true,
                createdAt: true,
                status: true,
              },
            })
          : Promise.resolve([])

        const [imageUsed, videoUsed, history] = await Promise.all([
          prisma.campaign.count({
            where: {
              ...periodWhere,
              OR: [{ mediaType: null }, { mediaType: 'image' }],
            },
          }),
          prisma.campaign.count({
            where: {
              ...periodWhere,
              mediaType: 'video',
            },
          }),
          historyPromise,
        ])

        return {
          imageUsed,
          videoUsed,
          history: history.map(campaign => ({
            id: campaign.id,
            title: campaign.title,
            mediaType: campaign.mediaType === 'video' ? 'video' : 'image',
            createdAt: campaign.createdAt,
            status: campaign.status,
          })),
        }
      } catch (err) {
        console.warn('Prisma getCampaignUsageSummary failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    const campaigns = db.campaigns
      .filter(campaign => campaign.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    const periodCampaigns = periodStart
      ? campaigns.filter(campaign => campaign.createdAt.getTime() >= periodStart.getTime())
      : campaigns

    return {
      imageUsed: periodCampaigns.filter(campaign => (campaign as { mediaType?: string }).mediaType !== 'video').length,
      videoUsed: periodCampaigns.filter(campaign => (campaign as { mediaType?: string }).mediaType === 'video').length,
      history: campaigns.slice(0, historyLimit).map(campaign => ({
        id: campaign.id,
        title: campaign.title,
        mediaType: (campaign as { mediaType?: string }).mediaType === 'video' ? 'video' : 'image',
        createdAt: campaign.createdAt,
        status: campaign.status,
      })),
    }
  },

  async deleteCampaign(userId: string, campaignId: string): Promise<boolean> {
    if (!isMock() && !campaignId.startsWith('c-')) {
      try {
        const result = await prisma.campaign.deleteMany({ where: { id: campaignId, userId } })
        return result.count > 0
      } catch (err) {
        console.warn('Prisma deleteCampaign failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    const exists = db.campaigns.some(campaign => campaign.id === campaignId && campaign.userId === userId)
    if (!exists) return false
    db.campaigns = db.campaigns.filter(campaign => campaign.id !== campaignId)
    db.slides = db.slides.filter(slide => slide.campaignId !== campaignId)
    db.posts = db.posts.filter(post => post.campaignId !== campaignId)
    writeMockDb(db)
    return true
  },

  async deleteExpiredCampaignsForUser(userId: string, plan: string, now = new Date()): Promise<number> {
    if (!isMock()) {
      try {
        const expiresBefore = new Date(now.getTime() - getHistoryRetentionDays(plan) * 24 * 60 * 60 * 1000)
        const result = await prisma.campaign.deleteMany({
          where: { userId, createdAt: { lte: expiresBefore } },
        })
        return result.count
      } catch (err) {
        console.warn('Prisma deleteExpiredCampaignsForUser failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    const expiredIds = new Set(db.campaigns
      .filter(campaign => campaign.userId === userId && getHistoryRetentionStatus(campaign.createdAt, plan, now).isExpired)
      .map(campaign => campaign.id))
    if (expiredIds.size === 0) return 0
    db.campaigns = db.campaigns.filter(campaign => !expiredIds.has(campaign.id))
    db.slides = db.slides.filter(slide => !expiredIds.has(slide.campaignId))
    db.posts = db.posts.filter(post => !expiredIds.has(post.campaignId))
    writeMockDb(db)
    return expiredIds.size
  },

  async deleteExpiredCampaigns(now = new Date()): Promise<number> {
    if (!isMock()) {
      const users = await prisma.user.findMany({ select: { id: true, plan: true } })
      const counts = await Promise.all(
        users.map(user => this.deleteExpiredCampaignsForUser(user.id, user.plan, now)),
      )
      return counts.reduce((total, count) => total + count, 0)
    }

    const db = initMockDb()
    const planByUserId = new Map(db.users.map(user => [user.id, user.plan]))
    const expiredIds = new Set(db.campaigns
      .filter(campaign => getHistoryRetentionStatus(campaign.createdAt, planByUserId.get(campaign.userId) || 'FREE', now).isExpired)
      .map(campaign => campaign.id))
    if (expiredIds.size === 0) return 0
    db.campaigns = db.campaigns.filter(campaign => !expiredIds.has(campaign.id))
    db.slides = db.slides.filter(slide => !expiredIds.has(slide.campaignId))
    db.posts = db.posts.filter(post => !expiredIds.has(post.campaignId))
    writeMockDb(db)
    return expiredIds.size
  },

  async reserveRegenerationImages(
    campaignId: string,
    requestedImages: number,
    imageModel: string,
  ): Promise<{ allowed: boolean; used: number; limit: number }> {
    if (requestedImages < 1) throw new Error('requestedImages must be positive')

    if (!isMock() && !campaignId.startsWith('c-')) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { slideCount: true, regenerationImageCount: true, user: { select: { email: true } } },
      })
      if (!campaign) throw new Error('Campaign not found')

      if (campaign.user?.email?.toLowerCase() === 'test@test.com') {
        return { allowed: true, used: 0, limit: 999999 }
      }

      const maxUsedBeforeReservation = campaign.slideCount - requestedImages
      if (maxUsedBeforeReservation < 0) {
        return { allowed: false, used: campaign.regenerationImageCount, limit: campaign.slideCount }
      }

      const reserved = await prisma.campaign.updateMany({
        where: {
          id: campaignId,
          regenerationImageCount: { lte: maxUsedBeforeReservation },
        },
        data: {
          regenerationImageCount: { increment: requestedImages },
          lastRegenerationImageModel: imageModel,
        },
      })
      const refreshed = await prisma.campaign.findUniqueOrThrow({
        where: { id: campaignId },
        select: { slideCount: true, regenerationImageCount: true },
      })
      return {
        allowed: reserved.count === 1,
        used: refreshed.regenerationImageCount,
        limit: refreshed.slideCount,
      }
    }

    const db = initMockDb()
    const idx = db.campaigns.findIndex(c => c.id === campaignId)
    if (idx === -1) throw new Error('Campaign not found')
    const campaign = db.campaigns[idx]
    const user = db.users.find(u => u.id === campaign.userId)
    if (user?.email?.toLowerCase() === 'test@test.com') {
      return { allowed: true, used: 0, limit: 999999 }
    }
    const limit = campaign.slideCount
    if (campaign.regenerationImageCount + requestedImages > limit) {
      return { allowed: false, used: campaign.regenerationImageCount, limit }
    }
    campaign.regenerationImageCount += requestedImages
    campaign.lastRegenerationImageModel = imageModel
    campaign.updatedAt = new Date()
    writeMockDb(db)
    return { allowed: true, used: campaign.regenerationImageCount, limit }
  },

  async updateCampaignStatus(campaignId: string, status: string): Promise<Campaign> {
    if (!isMock()) {
      try {
        return await prisma.campaign.update({
          where: { id: campaignId },
          data: { status },
        })
      } catch (err) {
        console.warn('Prisma updateCampaignStatus failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    const idx = db.campaigns.findIndex(c => c.id === campaignId)
    if (idx !== -1) {
      db.campaigns[idx].status = status
      db.campaigns[idx].updatedAt = new Date()
      writeMockDb(db)
      return db.campaigns[idx]
    }
    throw new Error('Campaign not found')
  },

  async updateSlideContent(slideId: string, headline: string, body: string, imageUrl?: string | null): Promise<CarouselSlide> {
    if (!isMock()) {
      try {
        const updateData: { headline: string; body: string; imageUrl?: string | null } = { headline, body }
        if (imageUrl !== undefined) {
          updateData.imageUrl = imageUrl
        }
        return await prisma.carouselSlide.update({
          where: { id: slideId },
          data: updateData,
        })
      } catch (err) {
        console.warn('Prisma updateSlideContent failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    const idx = db.slides.findIndex(s => s.id === slideId)
    if (idx !== -1) {
      db.slides[idx].headline = headline
      db.slides[idx].body = body
      if (imageUrl !== undefined) {
        db.slides[idx].imageUrl = imageUrl
      }
      db.slides[idx].updatedAt = new Date()
      writeMockDb(db)
      return db.slides[idx]
    }
    throw new Error('Slide not found')
  },

  async updateSlideCustomization(slideId: string, data: {
    headline?: string
    body?: string
    imageUrl?: string | null
    backgroundImageUrl?: string | null
    mediaType?: 'image' | 'video'
    videoUrl?: string | null
    videoThumbnailUrl?: string | null
    videoStartSec?: number | null
    videoDurationSec?: number | null
    fontPreset?: string | null
    textColor?: string | null
    headlineFontSize?: number | null
    bodyFontSize?: number | null
    editorDocument?: string | null
  }): Promise<CarouselSlide> {
    if (!isMock()) {
      try {
        return await prisma.carouselSlide.update({
          where: { id: slideId },
          data,
        })
      } catch (err) {
        console.warn('Prisma updateSlideCustomization failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    const idx = db.slides.findIndex(s => s.id === slideId)
    if (idx !== -1) {
      db.slides[idx] = {
        ...db.slides[idx],
        ...data,
        updatedAt: new Date(),
      }
      writeMockDb(db)
      return db.slides[idx]
    }
    throw new Error('Slide not found')
  },

  // Post & Scheduling operations
  async getPost(postId: string): Promise<Post | null> {
    if (postId.startsWith('p-') || postId.startsWith('post-')) {
      const db = initMockDb()
      return db.posts.find(p => p.id === postId) || null
    }

    if (!isMock()) {
      try {
        const post = await prisma.post.findUnique({
          where: { id: postId },
        })
        if (post) return post
      } catch (err) {
        console.warn('Prisma getPost failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    return db.posts.find(p => p.id === postId) || null
  },

  async getPostByCampaign(userId: string, campaignId: string): Promise<Post | null> {
    if (!isMock() && !campaignId.startsWith('c-')) {
      try {
        return await prisma.post.findFirst({ where: { userId, campaignId } })
      } catch (err) {
        console.warn('Prisma getPostByCampaign failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    return db.posts.find(post => post.userId === userId && post.campaignId === campaignId) || null
  },

  async getPosts(userId: string): Promise<(Post & { campaign: Campaign; brand: Brand })[]> {
    if (!isMock()) {
      try {
        const posts = await prisma.post.findMany({
          where: { userId },
          orderBy: { scheduledAt: 'asc' },
          include: {
            campaign: {
              include: {
                slides: true,
              },
            },
            brand: true,
          },
        })
        return posts as unknown as (Post & { campaign: Campaign; brand: Brand })[]
      } catch (err) {
        console.warn('Prisma getPosts failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    const posts = db.posts.filter(p => p.userId === userId).sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
    return posts.map(p => {
      const campaign = db.campaigns.find(c => c.id === p.campaignId)!
      const brand = db.brands.find(b => b.id === p.brandId)!
      const slides = db.slides.filter(s => s.campaignId === campaign.id).sort((a, b) => a.slideNumber - b.slideNumber)
      return {
        ...p,
        campaign: {
          ...campaign,
          slides,
        },
        brand,
      }
    })
  },

  async createPost(userId: string, brandId: string, campaignId: string, data: { caption: string; hashtags: string; scheduledAt: Date }): Promise<Post> {
    if (!isMock()) {
      try {
        return await prisma.post.create({
          data: {
            userId,
            brandId,
            campaignId,
            caption: data.caption,
            hashtags: data.hashtags,
            scheduledAt: data.scheduledAt,
            status: 'scheduled',
          },
        })
      } catch (err) {
        console.warn('Prisma createPost failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    const post: Post = {
      id: `p-${Date.now()}`,
      campaignId,
      userId,
      brandId,
      caption: data.caption,
      hashtags: data.hashtags,
      scheduledAt: data.scheduledAt,
      instagramMediaId: null,
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    db.posts.push(post)
    writeMockDb(db)
    return post
  },

  async updatePostStatus(postId: string, status: string, instagramMediaId?: string): Promise<Post> {
    if (!isMock()) {
      try {
        return await prisma.post.update({
          where: { id: postId },
          data: {
            status,
            ...(instagramMediaId ? { instagramMediaId } : {}),
          },
        })
      } catch (err) {
        console.warn('Prisma updatePostStatus failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    const idx = db.posts.findIndex(p => p.id === postId)
    if (idx !== -1) {
      db.posts[idx].status = status
      if (instagramMediaId) {
        db.posts[idx].instagramMediaId = instagramMediaId
      }
      db.posts[idx].updatedAt = new Date()
      writeMockDb(db)
      return db.posts[idx]
    }
    throw new Error('Post not found')
  },

  async updatePostDetails(postId: string, caption: string, hashtags: string): Promise<Post> {
    if (!isMock()) {
      try {
        return await prisma.post.update({
          where: { id: postId },
          data: { caption, hashtags },
        })
      } catch (err) {
        console.warn('Prisma updatePostDetails failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    const idx = db.posts.findIndex(p => p.id === postId)
    if (idx !== -1) {
      db.posts[idx].caption = caption
      db.posts[idx].hashtags = hashtags
      db.posts[idx].updatedAt = new Date()
      writeMockDb(db)
      return db.posts[idx]
    }
    throw new Error('Post not found')
  },

  async getPendingScheduledPosts(): Promise<(Post & { campaign: Campaign; brand: Brand })[]> {
    const now = new Date()
    if (!isMock()) {
      try {
        const posts = await prisma.post.findMany({
          where: {
            status: 'scheduled',
            scheduledAt: {
              lte: now,
            },
          },
          include: {
            campaign: {
              include: {
                slides: true,
              },
            },
            brand: true,
          },
        })
        return posts as unknown as (Post & { campaign: Campaign; brand: Brand })[]
      } catch (err) {
        console.warn('Prisma getPendingScheduledPosts failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    const posts = db.posts.filter(p => p.status === 'scheduled' && p.scheduledAt.getTime() <= now.getTime())
    return posts.map(p => {
      const campaign = db.campaigns.find(c => c.id === p.campaignId)!
      const brand = db.brands.find(b => b.id === p.brandId)!
      const slides = db.slides.filter(s => s.campaignId === campaign.id).sort((a, b) => a.slideNumber - b.slideNumber)
      return {
        ...p,
        campaign: {
          ...campaign,
          slides,
        },
        brand,
      }
    })
  },

  async updatePostScheduledTime(postId: string, scheduledAt: Date): Promise<Post> {
    if (!isMock()) {
      try {
        return await prisma.post.update({
          where: { id: postId },
          data: { scheduledAt },
        })
      } catch (err) {
        console.warn('Prisma updatePostScheduledTime failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') {
          throw err
        }
      }
    }

    const db = initMockDb()
    const idx = db.posts.findIndex(p => p.id === postId)
    if (idx !== -1) {
      db.posts[idx].scheduledAt = scheduledAt
      db.posts[idx].updatedAt = new Date()
      writeMockDb(db)
      return db.posts[idx]
    }
    throw new Error('Post not found')
  },

  // ─── Intelligence Layer ───────────────────────────────────────────────────

  async createEditLog(data: {
    userId: string
    brandId: string
    campaignId?: string
    slideId?: string
    eventType: string
    editDelta?: string
    metadata?: string
  }): Promise<void> {
    if (!isMock()) {
      try {
        await prisma.userEditLog.create({ data: {
          userId: data.userId,
          brandId: data.brandId,
          campaignId: data.campaignId ?? null,
          slideId: data.slideId ?? null,
          eventType: data.eventType,
          editDelta: data.editDelta ?? null,
          metadata: data.metadata ?? null,
        }})
        return
      } catch (err) {
        console.warn('Prisma createEditLog failed', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') throw err
      }
    }
    // Mock: no-op (no edit log array in mock DB)
  },

  async getSummarizedPreference(brandId: string): Promise<{
    summary: string | null
    preferredHookPatterns: string | null
    preferredLayouts: string | null
    avoidPatterns: string | null
    preferredCopyTone: string | null
  } | null> {
    if (!isMock()) {
      try {
        const pref = await prisma.summarizedPreference.findUnique({ where: { brandId } })
        if (!pref) return null
        return {
          summary: pref.summary,
          preferredHookPatterns: pref.preferredHookPatterns,
          preferredLayouts: pref.preferredLayouts,
          avoidPatterns: pref.avoidPatterns,
          preferredCopyTone: pref.preferredCopyTone,
        }
      } catch (err) {
        console.warn('Prisma getSummarizedPreference failed', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') throw err
      }
    }
    return null
  },

  async upsertSummarizedPreference(data: {
    userId: string
    brandId: string
    summary?: string
    preferredHookPatterns?: string
    preferredLayouts?: string
    preferredEmotions?: string
    preferredCopyTone?: string
    preferredColorStyle?: string
    avoidPatterns?: string
    editLogCountAtCompress?: number
  }): Promise<void> {
    if (!isMock()) {
      try {
        await prisma.summarizedPreference.upsert({
          where: { brandId: data.brandId },
          update: {
            summary: data.summary ?? null,
            preferredHookPatterns: data.preferredHookPatterns ?? null,
            preferredLayouts: data.preferredLayouts ?? null,
            preferredEmotions: data.preferredEmotions ?? null,
            preferredCopyTone: data.preferredCopyTone ?? null,
            preferredColorStyle: data.preferredColorStyle ?? null,
            avoidPatterns: data.avoidPatterns ?? null,
            editLogCountAtCompress: data.editLogCountAtCompress ?? 0,
            compressedAt: new Date(),
          },
          create: {
            userId: data.userId,
            brandId: data.brandId,
            summary: data.summary ?? null,
            preferredHookPatterns: data.preferredHookPatterns ?? null,
            preferredLayouts: data.preferredLayouts ?? null,
            preferredEmotions: data.preferredEmotions ?? null,
            preferredCopyTone: data.preferredCopyTone ?? null,
            preferredColorStyle: data.preferredColorStyle ?? null,
            avoidPatterns: data.avoidPatterns ?? null,
            editLogCountAtCompress: data.editLogCountAtCompress ?? 0,
          },
        })
        return
      } catch (err) {
        console.warn('Prisma upsertSummarizedPreference failed', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') throw err
      }
    }
    // Mock: no-op
  },

  async createQualityScoreLog(data: {
    campaignId: string
    userId: string
    passed: boolean
    score: number
    narrativeFlowScore: number
    personaFitScore: number
    hookPatternScore: number
    issueCount: number
    issuesJson?: string
    hookPatternUsed?: string
    personaUsed?: string
    industryUsed?: string
    trendContextUsed?: boolean
    memoryContextUsed?: boolean
  }): Promise<void> {
    if (!isMock()) {
      try {
        await prisma.qualityScoreLog.create({ data: {
          campaignId: data.campaignId,
          userId: data.userId,
          passed: data.passed,
          score: data.score,
          narrativeFlowScore: data.narrativeFlowScore,
          personaFitScore: data.personaFitScore,
          hookPatternScore: data.hookPatternScore,
          issueCount: data.issueCount,
          issuesJson: data.issuesJson ?? null,
          hookPatternUsed: data.hookPatternUsed ?? null,
          personaUsed: data.personaUsed ?? null,
          industryUsed: data.industryUsed ?? null,
          trendContextUsed: data.trendContextUsed ?? false,
          memoryContextUsed: data.memoryContextUsed ?? false,
        }})
        return
      } catch (err) {
        console.warn('Prisma createQualityScoreLog failed', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') throw err
      }
    }
    // Mock: no-op
  },

  // Template operations
  async getTemplates(userId: string): Promise<Template[]> {
    if (!isMock()) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const templates = await (prisma as any).template.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        })
        return templates as Template[]
      } catch (err) {
        console.warn('Prisma getTemplates failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') throw err
      }
    }
    const db = initMockDb()
    return (db.templates || []).filter(t => t.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  },

  async createTemplate(userId: string, data: { name: string; document: string; slideNumber?: number | null; thumbnail?: string | null }): Promise<Template> {
    if (!isMock()) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const template = await (prisma as any).template.create({
          data: { userId, name: data.name, document: data.document, slideNumber: data.slideNumber ?? null, thumbnail: data.thumbnail ?? null },
        })
        return template as Template
      } catch (err) {
        console.warn('Prisma createTemplate failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') throw err
      }
    }
    const db = initMockDb()
    const template: Template = {
      id: `tmpl-${Date.now()}`,
      userId,
      name: data.name,
      document: data.document,
      slideNumber: data.slideNumber ?? null,
      thumbnail: data.thumbnail ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    if (!db.templates) db.templates = []
    db.templates.push(template)
    writeMockDb(db)
    return template
  },

  async deleteTemplate(userId: string, templateId: string): Promise<void> {
    if (!isMock()) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).template.deleteMany({
          where: { id: templateId, userId },
        })
        return
      } catch (err) {
        console.warn('Prisma deleteTemplate failed, falling back to mock database', err)
        if (process.env.DATABASE_MOCK_FALLBACK === 'false') throw err
      }
    }
    const db = initMockDb()
    if (db.templates) {
      db.templates = db.templates.filter(t => !(t.id === templateId && t.userId === userId))
      writeMockDb(db)
    }
  },
}
