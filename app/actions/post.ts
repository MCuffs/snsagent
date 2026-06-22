'use server'

import { dbService } from '../../lib/db-service'
import { getSessionUser, getErrorMessage, forbidden, unauthenticated, failed } from './_shared'

// Update post caption & hashtags
export async function updatePostDetailsAction(postId: string, caption: string, hashtags: string) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  try {
    const existingPost = await dbService.getPost(postId)
    if (!existingPost) return failed('피드를 찾을 수 없습니다.')
    if (existingPost.userId !== user.id) return forbidden()

    const post = await dbService.updatePostDetails(postId, caption, hashtags)
    return { success: true as const, post }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '피드 정보 수정에 실패했습니다.'))
  }
}
