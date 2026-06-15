'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import PushButton from '@/components/ui/PushButton'

export default function TopBar({ title, profile }) {
  const [notifs, setNotifs] = useState([])
  const [open, setOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!profile?.id) return
    supabase.from('notifications').select('*')
      .eq('user_id', profile.id).eq('read', false)
      .order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => setNotifs(data || []))

    const channel = supabase.channel('notifs').on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}` },
      payload => setNotifs(prev => [payload.new, ...prev])
    ).subscribe()

    return () => supabase.removeChannel(channel)
  }, [profile?.id])

  const markRead = async (id) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  const now = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div className="tb">
      <div>
        <div className="tb-t">{title}</div>
        <div style={{ fontSize:12, color:'var(--gy)' }}>
          {now.charAt(0).toUpperCase() + now.slice(1)}
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8, background:'#F8FAFC',
        border:'1px solid var(--br)', borderRadius:10, padding:'8px 14px',
        width:220, marginLeft:'auto' }}>
        <span style={{ color:'var(--gy)' }}>🔍</span>
        <input placeholder="Rechercher..." style={{ border:'none', outline:'none',
          background:'transparent', fontFamily:'inherit', fontSize:13,
          color:'var(--gd)', width:'100%' }} />
      </div>

      {/* Bouton notifications push */}
      <PushButton />

      {/* Cloche notifications in-app */}
      <div style={{ position:'relative' }}>
        <div onClick={() => setOpen(!open)} style={{ width:40, height:40, borderRadius:10,
          background:'#F8FAFC', border:'1px solid var(--br)', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:17, position:'relative' }}>
          🔔
          {notifs.length > 0 && (
            <span style={{ position:'absolute', top:6, right:6, width:8, height:8,
              borderRadius:'50%', background:'var(--re)' }} />
          )}
        </div>
        {open && (
          <div style={{ position:'absolute', right:0, top:48, width:320,
            background:'#fff', borderRadius:16,
            boxShadow:'0 8px 32px rgba(0,0,0,.12)',
            border:'1px solid #F1F5F9', zIndex:1000 }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid #F1F5F9',
              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:14, fontWeight:700 }}>Notifications</span>
              <span style={{ fontSize:11, color:'var(--re)', fontWeight:600 }}>
                {notifs.length} non lues
              </span>
            </div>
            {notifs.length === 0 && (
              <div style={{ padding:24, textAlign:'center', color:'var(--gy)', fontSize:13 }}>
                Tout est a jour !
              </div>
            )}
            {notifs.map(n => (
              <div key={n.id} onClick={() => markRead(n.id)}
                style={{ padding:'12px 16px', borderBottom:'1px solid #F8FAFC',
                  background:'#F0F7FF', display:'flex', gap:10, cursor:'pointer' }}>
                <div style={{ width:8, height:8, borderRadius:'50%',
                  background:'#3B82F6', marginTop:5, flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600, lineHeight:1.4 }}>{n.title}</div>
                  <div style={{ fontSize:11, color:'var(--gy)', marginTop:3 }}>{n.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
