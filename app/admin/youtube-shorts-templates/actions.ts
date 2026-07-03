'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdminUser } from '../../../lib/admin'
import { deleteShortsTemplate, saveShortsTemplate, setDefaultShortsTemplate } from '../../../lib/youtube-shorts-templates/db'
import { shortsTemplateInputSchema } from '../../../lib/youtube-shorts-templates/types'

function payload(formData: FormData) {
  const raw = formData.get('payload')
  if (typeof raw !== 'string') throw new Error('Template payload is missing.')
  return shortsTemplateInputSchema.parse(JSON.parse(raw))
}

export async function saveShortsTemplateAction(formData: FormData) {
  await requireAdminUser()
  const id = formData.get('id')
  const saved = await saveShortsTemplate(payload(formData), typeof id === 'string' && id ? id : undefined)
  revalidatePath('/admin/youtube-shorts-templates')
  redirect(`/admin/youtube-shorts-templates/${saved.id}`)
}

export async function deleteShortsTemplateAction(formData: FormData) {
  await requireAdminUser()
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return
  await deleteShortsTemplate(id)
  revalidatePath('/admin/youtube-shorts-templates')
  redirect('/admin/youtube-shorts-templates')
}

export async function setDefaultShortsTemplateAction(formData: FormData) {
  await requireAdminUser()
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return
  await setDefaultShortsTemplate(id)
  revalidatePath('/admin/youtube-shorts-templates')
}
