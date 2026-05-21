import crypto from 'crypto'

export interface InstagramClientConfig {
  accountId: string
  accessToken: string
  mockMode?: boolean
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function readInstagramError(res: Response, fallback: string) {
  const errorJson = await res.json().catch((): unknown => ({}))
  if (
    typeof errorJson === 'object' &&
    errorJson !== null &&
    'error' in errorJson &&
    typeof errorJson.error === 'object' &&
    errorJson.error !== null &&
    'message' in errorJson.error &&
    typeof errorJson.error.message === 'string'
  ) {
    return errorJson.error.message
  }
  return fallback
}

function getTokenEncryptionKey() {
  const secret =
    process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    process.env.DATABASE_URL ||
    'instaagent-local-development-token-key'

  return crypto.createHash('sha256').update(secret).digest()
}

/**
 * Encrypts/decrypts Instagram access tokens before database storage.
 * New values use AES-256-GCM. Legacy base64-only values are still readable
 * so existing local demo data does not break during upgrades.
 */
export const tokenEncryptor = {
  encrypt(token: string): string {
    if (!token) return ''

    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', getTokenEncryptionKey(), iv)
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()

    return [
      'v1',
      iv.toString('base64url'),
      tag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join(':')
  },
  decrypt(encrypted: string): string {
    if (!encrypted) return ''

    if (!encrypted.startsWith('v1:')) {
      return Buffer.from(encrypted, 'base64').toString('utf8')
    }

    const [, iv, tag, payload] = encrypted.split(':')
    if (!iv || !tag || !payload) {
      throw new Error('Invalid encrypted token format')
    }

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getTokenEncryptionKey(),
      Buffer.from(iv, 'base64url')
    )
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))

    return Buffer.concat([
      decipher.update(Buffer.from(payload, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  }
}

/**
 * Validates connection with Instagram Graph API
 */
export async function validateInstagramConnection(
  accountId: string,
  accessToken: string
): Promise<{ success: boolean; username?: string; error?: string }> {
  const isMock = process.env.INSTAGRAM_MOCK_MODE === 'true' || !accessToken

  if (isMock) {
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 600))
    if (accountId.length < 10) {
      return { success: false, error: 'Invalid Instagram Account ID. Must be at least 10 digits.' }
    }
    return { success: true, username: 'instaagent_mock_business' }
  }

  try {
    // Meta Graph API Call: GET /v19.0/{instagram-business-account-id}?fields=username&access_token={access-token}
    const url = `https://graph.facebook.com/v19.0/${accountId}?fields=username&access_token=${accessToken}`
    const res = await fetch(url)
    
    if (!res.ok) {
      return { 
        success: false, 
        error: await readInstagramError(res, `API error (HTTP ${res.status})`) 
      }
    }

    const data = await res.json() as { username?: string }
    return { success: true, username: data.username }
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, 'Network error occurred during connection.') }
  }
}

/**
 * Step 1 in Instagram publishing: Create a media container for an image or slide
 */
export async function createMediaContainer(
  accountId: string,
  accessToken: string,
  imageUrl: string,
  caption: string,
  isCarouselItem = false
): Promise<{ containerId: string }> {
  const isMock = process.env.INSTAGRAM_MOCK_MODE === 'true' || !accessToken

  if (isMock) {
    await new Promise(resolve => setTimeout(resolve, 400))
    return { containerId: `container_${Date.now()}_${Math.floor(Math.random() * 1000)}` }
  }

  try {
    // Meta Graph API Call: POST /v19.0/{instagram-business-account-id}/media
    // Form parameters: image_url, caption, access_token, and is_carousel_item if part of carousel
    const url = `https://graph.facebook.com/v19.0/${accountId}/media`
    const body: Record<string, string> = {
      image_url: imageUrl,
      access_token: accessToken,
    }
    
    if (isCarouselItem) {
      body.is_carousel_item = 'true'
    } else {
      body.caption = caption
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      throw new Error(await readInstagramError(res, `Failed to create container (HTTP ${res.status})`))
    }

    const data = await res.json() as { id: string }
    return { containerId: data.id }
  } catch (err: unknown) {
    console.error('Error in createMediaContainer:', err)
    throw err
  }
}

/**
 * Step 2 (Optional) for Carousels: Create a carousel container containing child slides
 */
export async function createCarouselContainer(
  accountId: string,
  accessToken: string,
  childrenContainerIds: string[],
  caption: string
): Promise<{ containerId: string }> {
  const isMock = process.env.INSTAGRAM_MOCK_MODE === 'true' || !accessToken

  if (isMock) {
    await new Promise(resolve => setTimeout(resolve, 400))
    return { containerId: `carousel_container_${Date.now()}` }
  }

  try {
    // Meta Graph API Call: POST /v19.0/{instagram-business-account-id}/media
    // Body: { media_type: 'CAROUSEL', children: [id1, id2...], caption, access_token }
    const url = `https://graph.facebook.com/v19.0/${accountId}/media`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        children: childrenContainerIds,
        caption,
        access_token: accessToken
      })
    })

    if (!res.ok) {
      throw new Error(await readInstagramError(res, `Failed to create carousel container (HTTP ${res.status})`))
    }

    const data = await res.json() as { id: string }
    return { containerId: data.id }
  } catch (err: unknown) {
    console.error('Error in createCarouselContainer:', err)
    throw err
  }
}

/**
 * Step 3: Publish the container (single image or carousel container) to live Instagram feed
 */
export async function publishMedia(
  accountId: string,
  accessToken: string,
  containerId: string
): Promise<{ mediaId: string }> {
  const isMock = process.env.INSTAGRAM_MOCK_MODE === 'true' || !accessToken

  if (isMock) {
    await new Promise(resolve => setTimeout(resolve, 500))
    return { mediaId: `ig_media_${Date.now()}` }
  }

  try {
    // Meta Graph API Call: POST /v19.0/{instagram-business-account-id}/media_publish
    // Body: { creation_id: containerId, access_token }
    const url = `https://graph.facebook.com/v19.0/${accountId}/media_publish`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken
      })
    })

    if (!res.ok) {
      throw new Error(await readInstagramError(res, `Failed to publish media (HTTP ${res.status})`))
    }

    const data = await res.json() as { id: string }
    return { mediaId: data.id }
  } catch (err: unknown) {
    console.error('Error in publishMedia:', err)
    throw err
  }
}

/**
 * Schedules a post or publishes it immediately.
 * For MVP, we simulate the actual API post scheduling or fire a direct upload background task.
 * Note: Instagram Graph API does not support a native "schedule" parameter via API directly, 
 * so third-party tools like Buffer/Hootsuite or our own server must keep posts in a DB and 
 * run a cron-job task to call publishMedia() at the scheduled time.
 */
export async function schedulePost(
  accountId: string,
  accessToken: string,
  imageUrls: string[],
  caption: string,
  scheduledAt: Date
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  try {
    // If the post is scheduled for "now" or is overdue, publish immediately.
    const isImmediate = new Date(scheduledAt).getTime() <= Date.now() + 60000 // within 1 minute

    if (isImmediate) {
      console.log('Immediate publish triggered')
      let publishContainerId = ''

      if (imageUrls.length === 1) {
        // Single Image Post
        const container = await createMediaContainer(accountId, accessToken, imageUrls[0], caption)
        publishContainerId = container.containerId
      } else {
        // Carousel Card News Post
        const itemIds: string[] = []
        for (const url of imageUrls) {
          const itemContainer = await createMediaContainer(accountId, accessToken, url, '', true)
          itemIds.push(itemContainer.containerId)
        }
        const carouselContainer = await createCarouselContainer(accountId, accessToken, itemIds, caption)
        publishContainerId = carouselContainer.containerId
      }

      const publishResult = await publishMedia(accountId, accessToken, publishContainerId)
      return { success: true, mediaId: publishResult.mediaId }
    } else {
      // Scheduled for the future. The client-side just confirms scheduling.
      // Our server-side actions will write it to the DB with status='scheduled'
      // and a background cron job runs to publish it at scheduledAt.
      console.log(`Successfully scheduled post for: ${scheduledAt.toISOString()}`)
      return { success: true }
    }
  } catch (err: unknown) {
    console.error('Instagram scheduling/publishing failed:', err)
    return { success: false, error: getErrorMessage(err, 'Failed to upload to Instagram') }
  }
}
