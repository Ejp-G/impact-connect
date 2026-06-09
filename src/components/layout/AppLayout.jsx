'use client'
import { useState } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppLayout({ children, profile, pageId, title }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar profile={profile} activeId={pageId} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="cw">
        <TopBar title={title} profile={profile} />
        <div className="main-area">{children}</div>
      </div>
    </div>
  )
}
