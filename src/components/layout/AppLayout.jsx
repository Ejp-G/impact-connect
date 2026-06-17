'use client'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import PushPrompt from '@/components/ui/PushPrompt'

export default function AppLayout({ children, profile, pageId, title }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile]   = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { setMobileOpen(false) }, [pageId])

  return (
    <div className="app-shell">
      {isMobile && (
        <div
          className={`mobile-overlay${mobileOpen?' on':''}`}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        profile={profile}
        activeId={pageId}
        collapsed={isMobile ? false : collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        isMobile={isMobile}
      />

      <div className="cw">
        <TopBar
          title={title}
          profile={profile}
          isMobile={isMobile}
          onMenuToggle={() => setMobileOpen(!mobileOpen)}
        />
        <div className="main-area">
          {children}
        </div>
      </div>

      <PushPrompt />
    </div>
  )
}
