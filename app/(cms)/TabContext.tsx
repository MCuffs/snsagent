'use client'

import { createContext, useContext, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface TabContextType {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const TabContext = createContext<TabContextType | null>(null)

export function TabProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') || 'concept'
  const [activeTab, setActiveTabState] = useState(initialTab)

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab)
    const params = new URLSearchParams(window.location.search)
    if (tab === 'concept') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const query = params.toString()
    const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname
    window.history.replaceState(null, '', newUrl)
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
