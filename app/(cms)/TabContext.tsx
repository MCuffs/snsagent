'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

interface TabContextType {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const TabContext = createContext<TabContextType | null>(null)

export function TabProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTabState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      return params.get('tab') || 'concept'
    }
    return 'concept'
  })

  // Sync state if search params change (e.g., browser back/forward buttons)
  useEffect(() => {
    const tab = searchParams.get('tab') || 'concept'
    setActiveTabState(tab)
  }, [searchParams])

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (tab === 'concept') {
        url.searchParams.delete('tab')
      } else {
        url.searchParams.set('tab', tab)
      }
      window.history.pushState(null, '', url.pathname + url.search)
    }
  }

  return (
    <TabContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabContext.Provider>
  )
}

export function useTab() {
  const context = useContext(TabContext)
  if (!context) {
    throw new Error('useTab must be used within a TabProvider')
  }
  return context
}
