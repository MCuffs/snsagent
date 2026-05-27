'use client'

import { createContext, useContext } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

interface TabContextType {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const TabContext = createContext<TabContextType | null>(null)

export function TabProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'concept'

  const setActiveTab = (tab: string) => {
    const params = new URLSearchParams(window.location.search)
    if (tab === 'concept') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const query = params.toString()
    const newUrl = query ? `${pathname}?${query}` : pathname
    // Native history calls update useSearchParams through the Next.js router.
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
