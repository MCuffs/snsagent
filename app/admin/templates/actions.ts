'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdminUser } from '../../../lib/admin'
import {
  createCardTemplate,
  updateCardTemplate,
  duplicateCardTemplate,
  deleteCardTemplate,
  makeDefaultTemplateConfig,
} from '../../../lib/templates/db'
import { templateConfigSchema, type SupportedSlideCount } from '../../../lib/templates/types'
import { z } from 'zod'

const savePayloadSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.enum(['active', 'draft']),
  config: templateConfigSchema,
})

function parsePayload(formData: FormData) {
  const raw = formData.get('payload')
  if (typeof raw !== 'string') return null
  try {
    return savePayloadSchema.parse(JSON.parse(raw))
  } catch {
    return null
  }
}

export async function createTemplateAction(formData: FormData) {
  await requireAdminUser()
  const payload = parsePayload(formData)
  if (!payload) throw new Error('유효하지 않은 템플릿 데이터입니다.')

  const created = await createCardTemplate({
    name: payload.name,
    description: payload.description ?? null,
    config: payload.config,
    status: payload.status,
  })
  revalidatePath('/admin/templates')
  redirect(`/admin/templates/${created.id}`)
}

export async function createDefaultTemplateAction(formData: FormData) {
  await requireAdminUser()
  const slideCountRaw = Number(formData.get('slideCount'))
  const slideCount: SupportedSlideCount = slideCountRaw === 7 ? 7 : 5
  const created = await createCardTemplate({
    name: `새 템플릿 (${slideCount}장)`,
    config: makeDefaultTemplateConfig(slideCount),
    status: 'draft',
  })
  revalidatePath('/admin/templates')
  redirect(`/admin/templates/${created.id}`)
}

export async function updateTemplateAction(formData: FormData) {
  await requireAdminUser()
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) throw new Error('템플릿 ID가 없습니다.')
  const payload = parsePayload(formData)
  if (!payload) throw new Error('유효하지 않은 템플릿 데이터입니다.')

  await updateCardTemplate(id, {
    name: payload.name,
    description: payload.description ?? null,
    config: payload.config,
    status: payload.status,
  })
  revalidatePath('/admin/templates')
  revalidatePath(`/admin/templates/${id}`)
}

export async function duplicateTemplateAction(formData: FormData) {
  await requireAdminUser()
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return
  const copy = await duplicateCardTemplate(id)
  revalidatePath('/admin/templates')
  if (copy) redirect(`/admin/templates/${copy.id}`)
}

export async function deleteTemplateAction(formData: FormData) {
  await requireAdminUser()
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return
  await deleteCardTemplate(id)
  revalidatePath('/admin/templates')
  redirect('/admin/templates')
}
