'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NAV_ITEMS, ROLE_NAV } from '@/lib/constants'

const ini = (nm) => nm?.split(' ').map(w=>w[0]).slice(0,2).join('') || 'U'

export default function Sidebar({ profile, activeId, collapsed, setCollapsed }) {
  const router = useRouter()
  const supabase = createClient()

  const access = ROLE_NAV[profile?.role]
  const visibleNav = NAV_ITEMS.filter(it => {
    if (it.id === 'utilisateurs' && profile?.role !== 'admin') return false
    if (access === 'all') return true
    return access?.includes(it.id)
  })

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className={`sb${collapsed?' col':''}`}>
      {/* Logo */}
      <div className="sbh">
        <div className="sbh-ic">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="7.5" y="1" width="3" height="16" rx="1.5" fill="white"/>
            <rect x="1" y="6" width="16" height="3" rx="1.5" fill="white"/>
          </svg>
        </div>
        {!collapsed && <div><div className="sb-nm">IMPACT</div><div className="sb-sm">CONNECT</div></div>}
      </div>

      {/* Toggle */}
      <button className="sbt" onClick={()=>setCollapsed(!collapsed)}>
        {collapsed ? '›' : '‹'}
      </button>

      {/* Nav */}
      <nav className="sbn">
        {visibleNav.map(item => (
          <Link key={item.id} href={item.href} className={`si${activeId===item.id?' on':''}`}
            title={collapsed ? item.label : ''}>
            <span className="si-ic">{item.icon}</span>
            {!collapsed && <span className="si-lb">{item.label}</span>}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="sbf" onClick={handleLogout} title="Déconnexion">
        <div className="sbu-av">{ini(profile?.name)}</div>
        {!collapsed && (
          <div style={{flex:1}}>
            <div className="sbu-n">{profile?.name || 'Utilisateur'}</div>
            <div className="sbu-r">{profile?.role === 'admin' ? 'Administrateur' : profile?.role}</div>
          </div>
        )}
        {!collapsed && <span style={{color:'rgba(255,255,255,.4)',fontSize:14}}>⏻</span>}
      </div>
    </div>
  )
}
