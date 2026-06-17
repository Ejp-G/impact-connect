'use client'
import { useState, useEffect } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

export default function PushPrompt() {
  const [visible, setVisible] = useState(false)
  const { subscribe } = usePushNotifications()

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    const seen = localStorage.getItem('ic_push_prompt_seen')
    const supported = 'serviceWorker' in navigator && 'PushManager' in window
    if (!seen && supported && Notification.permission === 'default') {
      const t = setTimeout(() => setVisible(true), 1200)
      return () => clearTimeout(t)
    }
  }, [])

  function dismiss() {
    localStorage.setItem('ic_push_prompt_seen', '1')
    setVisible(false)
  }

  async function accept() {
    await subscribe()
    localStorage.setItem('ic_push_prompt_seen', '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
      zIndex:5000, width:'calc(100% - 32px)', maxWidth:380,
      background:'#fff', borderRadius:18, boxShadow:'0 12px 40px rgba(0,0,0,.18)',
      padding:20, border:'1px solid #F1F5F9'
    }}>
      <div style={{ display:'flex', gap:12, marginBottom:14 }}>
        <div style={{ fontSize:28, flexShrink:0 }}>🔔</div>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:'#1E293B', marginBottom:4 }}>
            Activer les notifications ?
          </div>
          <div style={{ fontSize:12, color:'#64748B', lineHeight:1.5 }}>
            Recevez une alerte dès qu'un nouveau visiteur ou une tache vous concerne.
          </div>
        </div>
      </div>
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={dismiss} style={{
          flex:1, padding:'10px 0', borderRadius:10, border:'none', cursor:'pointer',
          background:'#F1F5F9', color:'#64748B', fontFamily:'inherit', fontSize:13, fontWeight:600
        }}>
          Plus tard
        </button>
        <button onClick={accept} style={{
          flex:1, padding:'10px 0', borderRadius:10, border:'none', cursor:'pointer',
          background:'#0B3D91', color:'#fff', fontFamily:'inherit', fontSize:13, fontWeight:700
        }}>
          Autoriser
        </button>
      </div>
    </div>
  )
}
