import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export type UserEditEventType =
  | 'headline_edit'
  | 'body_edit'
  | 'font_change'
  | 'layout_change'
  | 'color_change'
  | 'image_replace'
  | 'copy_rewrite'
  | 'reset'

export interface EditEvent {
  userId: string
  brandId: string
  campaignId?: string
  slideId?: string
  eventType: UserEditEventType
  editDelta?: { beforeLength: number; afterLength: number }
  metadata?: Record<string, unknown>
}

export async function logEditEvent(event: EditEvent): Promise<void> {
  try {
    await prisma.userEditLog.create({
      data: {
        userId: event.userId,
        brandId: event.brandId,
        campaignId: event.campaignId ?? null,
        slideId: event.slideId ?? null,
        eventType: event.eventType,
        editDelta: event.editDelta ? JSON.stringify(event.editDelta) : null,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      },
    })
  } catch {
    // Fire-and-forget — never throws to caller
  }
}
