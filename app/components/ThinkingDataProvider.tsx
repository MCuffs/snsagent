'use client'

import { useEffect } from 'react'
import { initThinkingData, identifyUser, setSuperProperties } from '../../lib/analytics/thinkingdata'

interface ThinkingDataProviderProps {
  userId?: string
  userEmail?: string
  userPlan?: string
  userName?: string
}

export default function ThinkingDataProvider({
  userId,
  userEmail,
  userPlan,
  userName,
}: ThinkingDataProviderProps) {
  useEffect(() => {
    initThinkingData().then(() => {
      if (userId) {
        identifyUser(userId, {
          email: userEmail,
          plan: userPlan,
          name: userName,
        })
        setSuperProperties({
          user_id: userId,
          plan: userPlan ?? 'FREE',
        })
      }
    })
  }, [userId, userEmail, userPlan, userName])

  return null
}
