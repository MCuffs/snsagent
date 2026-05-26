'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

interface TabContextType {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const TabContext = createContext<TabContextType | null>(null)

export function TabProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  // Read target tab from URL query searchParams
  const getTabFromUrl = () => searchParams.get('tab') || 'concept'
  
  const [activeTab, setActiveTabState] = useState<string>(getTabFromUrl)

  // Sync state if URL search parameters change externally (e.g. Back/Forward navigation)
  useEffect(() => {
    setActiveTabState(getTabFromUrl())
  }, [searchParams])

  const setActiveTab = (tab: string) => {
    // 1. Instantly update react state (0ms latency UI switch)
    setActiveTabState(tab)
    
    // 2. Silently update browser history address bar without triggering Next.js router delay
    const params = new URLSearchParams(window.location.search)
    if (tab === 'concept') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const query = params.toString()
    const newUrl = query ? `${pathname}?${query}` : pathname
    window.history.pushState(null, '', newUrl)
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
