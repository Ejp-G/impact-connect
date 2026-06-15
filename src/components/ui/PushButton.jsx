'use client'
import { usePushNotifications } from '@/hooks/usePushNotifications'

export default function PushButton() {
  const { subscribed, loading, permission, subscribe, unsubscribe } = usePushNotifications()

  if (permission === 'denied') return (
    <div title="Notifications bloquees dans votre navigateur" style={{fontSize:20,opacity:.4,cursor:'default'}}>🔕</div>
  )

  return (
    <div onClick={subscribed ? unsubscribe : subscribe} title={subscribed ? 'Desactiver les notifications' : 'Activer les notifications push'}
      style={{width:40,height:40,borderRadius:10,background:subscribed?'#EFF6FF':'#F8FAFC',border:`1px solid ${subscribed?'#BFDBFE':'var(--br)'}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,position:'relative',transition:'all .2s'}}>
      {loading ? '⏳' : subscribed ? '🔔' : '🔕'}
      {subscribed && <div style={{position:'absolute',top:6,right:6,width:8,height:8,borderRadius:'50%',background:'#22C55E'}} />}
    </div>
  )
}
