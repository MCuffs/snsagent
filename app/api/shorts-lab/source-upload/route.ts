import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { getSessionUser } from '../../../../lib/auth/user'
import { hasShortsLabFullAccess } from '../../../../lib/auth/shorts-lab-access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_SOURCE_BYTES = 2 * 1024 * 1024 * 1024
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: '원본 업로드 저장소가 설정되지 않았습니다.' },
      { status: 503 },
    )
  }

  let body: HandleUploadBody
  try {
    body = (await request.json()) as HandleUploadBody
  } catch {
    return Response.json({ error: '업로드 요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  try {
    const result = await handleUpload({
      request,
      body,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async pathname => {
        const user = await getSessionUser()
        if (!user || !hasShortsLabFullAccess(user)) {
          throw new Error('업로드 권한이 없습니다. 유료 플랜에서 이용할 수 있습니다.')
        }

        const allowedPrefix = `uploads/shorts-lab/${user.id}/`
        if (!pathname.startsWith(allowedPrefix)) {
          throw new Error('허용되지 않은 업로드 경로입니다.')
        }

        return {
          allowedContentTypes: ALLOWED_VIDEO_TYPES,
          maximumSizeInBytes: MAX_SOURCE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id }),
        }
      },
    })

    return Response.json(result)
  } catch (error) {
    console.error('[shorts-lab/source-upload]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : '원본 업로드를 시작하지 못했습니다.' },
      { status: 400 },
    )
  }
}
