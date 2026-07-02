'use client'

import { createContext, useContext, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { analytics } from '../../lib/analytics/thinkingdata'

interface TabContextType {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const TabContext = createContext<TabContextType | null>(null)
const DEFAULT_CONSOLE_TAB = 'youtube-automation'

export function TabProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') || DEFAULT_CONSOLE_TAB
  const [activeTab, setActiveTabState] = useState(initialTab)

  const setActiveTab = (tab: string) => {
    const prevTab = activeTab
    setActiveTabState(tab)
    const params = new URLSearchParams(window.location.search)
    if (tab === DEFAULT_CONSOLE_TAB) {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const query = params.toString()
    const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname
    window.history.replaceState(null, '', newUrl)
    window.setTimeout(() => {
      analytics.tabSwitch(prevTab, tab)
    }, 0)
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
