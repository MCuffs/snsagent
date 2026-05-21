import fs from 'fs'
import path from 'path'
import prisma from './db'

const DB_FILE_PATH = path.join(process.cwd(), 'prisma', 'db.json')

// Define TypeScript interfaces for our DB models
export interface User {
  id: string
  email: string
  name: string | null
  plan: string // FREE, STARTER, PRO, AGENCY
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
  createdAt: Date
  updatedAt: Date
}

export interface InstagramAccount {
  id: string
  userId: string
  brandId: string
  instagramAccountId: string
  accessTokenEncrypted: string
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
  createdAt: Date
  updatedAt: Date
  slides?: CarouselSlide[]
}

export interface CarouselSlide {
  id: string
  campaignId: string
  slideNumber: number
  headline: string
  body: string
  designPrompt: string
  imageUrl: string | null
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

// Local mock database structure
interface MockDatabase {
  users: User[]
  brands: Brand[]
  instagramAccounts: InstagramAccount[]
  campaigns: Campaign[]
  slides: CarouselSlide[]
  posts: Post[]
}

type StoredUser = Omit<User, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }
type StoredBrand = Omit<Brand, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }
type StoredInstagramAccount = Omit<InstagramAccount, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }
type StoredCampaign = Omit<Campaign, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }
type StoredCarouselSlide = Omit<CarouselSlide, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }
type StoredPost = Omit<Post, 'scheduledAt' | 'createdAt' | 'updatedAt'> & { scheduledAt: string; createdAt: string; updatedAt: string }

interface StoredMockDatabase {
  users?: StoredUser[]
  brands?: StoredBrand[]
  instagramAccounts?: StoredInstagramAccount[]
  campaigns?: StoredCampaign[]
  slides?: StoredCarouselSlide[]
  posts?: StoredPost[]
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
        users: (parsed.users || []).map((u) => ({ ...u, createdAt: new Date(u.createdAt), updatedAt: new Date(u.updatedAt) })),
        brands: (parsed.brands || []).map((b) => ({ ...b, createdAt: new Date(b.createdAt), updatedAt: new Date(b.updatedAt) })),
        instagramAccounts: (parsed.instagramAccounts || []).map((ia) => ({ ...ia, createdAt: new Date(ia.createdAt), updatedAt: new Date(ia.updatedAt) })),
        campaigns: (parsed.campaigns || []).map((c) => ({ ...c, createdAt: new Date(c.createdAt), updatedAt: new Date(c.updatedAt) })),
        slides: (parsed.slides || []).map((s) => ({ ...s, createdAt: new Date(s.createdAt), updatedAt: new Date(s.updatedAt) })),
        posts: (parsed.posts || []).map((p) => ({ ...p, scheduledAt: new Date(p.scheduledAt), createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) })),
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
  }
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(defaultDb, null, 2), 'utf8')
  return defaultDb
}

function writeMockDb(db: MockDatabase) {
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf8')
}

// Check if we should use Prisma database or Local Mock file database
const isMock = () => {
  return process.env.DATABASE_MOCK_FALLBACK === 'true' || !process.env.DATABASE_URL
}

export const dbService = {
  // User operations
  async getUser(userId: string): Promise<User | null> {
    if (!isMock()) {
      try {
        return await prisma.user.findUnique({
          where: { id: userId },
        })
      } catch (err) {
        console.warn('Prisma getUser failed, falling back to mock database', err)
      }
    }

    const db = initMockDb()
    return db.users.find(u => u.id === userId) || null
  },

  async getOrCreateUser(email: string, name?: string): Promise<User> {
    if (!isMock()) {
      try {
        const user = await prisma.user.upsert({
          where: { email },
          update: { name },
          create: { email, name, plan: 'FREE' },
        })
        return user
      } catch (err) {
        console.warn('Prisma getOrCreateUser failed, falling back to mock database', err)
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
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      db.users.push(user)
      writeMockDb(db)
    }
    return user
  },

  async updateUserPlan(userId: string, plan: string): Promise<User> {
    if (!isMock()) {
      try {
        return await prisma.user.update({
          where: { id: userId },
          data: { plan },
        })
      } catch (err) {
        console.warn('Prisma updateUserPlan failed, falling back to mock database', err)
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
      }
    }

    const db = initMockDb()
    return db.brands.filter(b => b.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  },

  async getBrand(brandId: string): Promise<Brand | null> {
    if (!isMock()) {
      try {
        return await prisma.brand.findUnique({
          where: { id: brandId },
        })
      } catch (err) {
        console.warn('Prisma getBrand failed, falling back to mock database', err)
      }
    }

    const db = initMockDb()
    return db.brands.find(b => b.id === brandId) || null
  },

  async getSlide(slideId: string): Promise<(CarouselSlide & { campaign: Campaign }) | null> {
    if (!isMock()) {
      try {
        const slide = await prisma.carouselSlide.findUnique({
          where: { id: slideId },
          include: { campaign: true },
        })
        return slide
      } catch (err) {
        console.warn('Prisma getSlide failed, falling back to mock database', err)
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
        if (brandId) {
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
        throw new Error('Brand not found')
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

  // Instagram operations
  async getInstagramAccount(userId: string, brandId: string): Promise<InstagramAccount | null> {
    if (!isMock()) {
      try {
        return await prisma.instagramAccount.findUnique({
          where: { brandId }, // unique index
        })
      } catch (err) {
        console.warn('Prisma getInstagramAccount failed, falling back to mock database', err)
      }
    }

    const db = initMockDb()
    return db.instagramAccounts.find(ia => ia.brandId === brandId) || null
  },

  async saveInstagramAccount(userId: string, brandId: string, instagramAccountId: string, accessTokenEncrypted: string): Promise<InstagramAccount> {
    if (!isMock()) {
      try {
        return await prisma.instagramAccount.upsert({
          where: { brandId },
          update: {
            instagramAccountId,
            accessTokenEncrypted,
            status: 'CONNECTED',
          },
          create: {
            userId,
            brandId,
            instagramAccountId,
            accessTokenEncrypted,
            status: 'CONNECTED',
          },
        })
      } catch (err) {
        console.warn('Prisma saveInstagramAccount failed, falling back to mock database', err)
      }
    }

    const db = initMockDb()
    let acc = db.instagramAccounts.find(ia => ia.brandId === brandId)
    if (acc) {
      acc.instagramAccountId = instagramAccountId
      acc.accessTokenEncrypted = accessTokenEncrypted
      acc.status = 'CONNECTED'
      acc.updatedAt = new Date()
    } else {
      acc = {
        id: `ia-${Date.now()}`,
        userId,
        brandId,
        instagramAccountId,
        accessTokenEncrypted,
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
    campaignData: { title: string; productName: string; productDescription: string; keyBenefits: string; objective: string; slideCount: number },
    slides: { slideNumber: number; headline: string; body: string; designPrompt: string; imageUrl?: string | null }[]
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
    if (!isMock()) {
      try {
        const c = await prisma.campaign.findUnique({
          where: { id: campaignId },
          include: { slides: { orderBy: { slideNumber: 'asc' } } },
        })
        return c
      } catch (err) {
        console.warn('Prisma getCampaign failed, falling back to mock database', err)
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
      }
    }

    const db = initMockDb()
    const campaigns = db.campaigns.filter(c => c.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return campaigns.map(c => ({
      ...c,
      slides: db.slides.filter(s => s.campaignId === c.id).sort((a, b) => a.slideNumber - b.slideNumber),
    }))
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

  // Post & Scheduling operations
  async getPost(postId: string): Promise<Post | null> {
    if (!isMock()) {
      try {
        return await prisma.post.findUnique({
          where: { id: postId },
        })
      } catch (err) {
        console.warn('Prisma getPost failed, falling back to mock database', err)
      }
    }

    const db = initMockDb()
    return db.posts.find(p => p.id === postId) || null
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
}
