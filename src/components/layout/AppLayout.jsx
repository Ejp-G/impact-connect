'use client'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppLayout({ children, profile, pageId, title }) {
  const [collapsed, setCollapsed]       = useState(false)
  const [mobileOpen, setMobileOpen]     = useState(false)
  const [isMobile, setIsMobile]         = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Fermer le menu mobile quand on change de page
  useEffect(() => { setMobileOpen(false) }, [pageId])

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      {/* Overlay mobile */}
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
        setMobileOpen={setMobileOpen}
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
    </div>
  )
}
