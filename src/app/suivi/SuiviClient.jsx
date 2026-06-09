'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PRIORITY_COLORS } from '@/lib/constants'
export default function SuiviClient({ tasks: initialTasks, profile }) {
  const [tasks, setTasks] = useState(initialTasks)
  const router = useRouter()
  async function toggleTask(id) {
    const res = await fetch('/api/tasks', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id, status:'done'}) })
    if (res.ok) { setTasks(prev => prev.filter(t => t.id !== id)); router.refresh() }
  }
  const urgent = tasks.filter(t=>t.priority==='urgent')
  const high = tasks.filter(t=>t.priority==='high')
  const normal = tasks.filter(t=>t.priority==='normal')
  function TaskGroup({ title, items, co }) {
    if (!items.length) return null
    return (
      <div style={{marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
          <div style={{width:12,height:12,borderRadius:3,background:co}} />
          <span style={{fontSize:13,fontWeight:700,textTransform:'uppercase',letterSpacing:.5}}>{title}</span>
          <span style={{background:`${co}20`,color:co,fontSize:11,fontWeight:700,padding:'1px 8px',borderRadius:999}}>{items.length}</span>
        </div>
        {items.map(t=>(
          <div key={t.id} style={{background:'#fff',borderRadius:12,padding:'14px 16px',borderLeft:`4px solid ${co}`,boxShadow:'0 1px 4px rgba(0,0,0,.04)',display:'flex',alignItems:'center',gap:14,marginBottom:8}}>
            <div onClick={()=>toggleTask(t.id)} style={{width:20,height:20,borderRadius:6,border:`2px solid ${co}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,background:'#fff'}}>
              <span style={{fontSize:10}}>○</span>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600}}><span style={{color:co}}>{t.type}</span> — {t.contact?.first_name} {t.contact?.last_name}</div>
              <div style={{fontSize:11,color:'var(--gy)',marginTop:3}}>{t.note||t.title} · {t.assignee?.name||'—'} · Échéance : {t.due_date}</div>
            </div>
            <span style={{background:`${co}15`,color:co,fontSize:11,fontWeight:600,padding:'4px 10px',borderRadius:8}}>
              {t.priority==='urgent'?'Urgent':t.priority==='high'?'Prioritaire':'Normal'}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div style={{maxWidth:900}}>
      <div className="g4" style={{marginBottom:24}}>
        {[['🔴 Urgentes',urgent.length,'#EF4444'],['🟠 Prioritaires',high.length,'#F97316'],['🟢 Normales',normal.length,'#22C55E'],['📋 Total',tasks.length,'#94A3B8']].map(([l,v,c])=>(
          <div key={l} className="card" style={{padding:16,borderTop:`3px solid ${c}`}}>
            <div style={{fontSize:12,color:'var(--gd)',marginBottom:4}}>{l}</div>
            <div style={{fontSize:28,fontWeight:800}}>{v}</div>
          </div>
        ))}
      </div>
      <TaskGroup title="🚨 Urgences" items={urgent} co="#EF4444" />
      <TaskGroup title="⚠️ Prioritaires" items={high} co="#F97316" />
      <TaskGroup title="📋 Normales" items={normal} co="#22C55E" />
      {tasks.length === 0 && <div className="card" style={{textAlign:'center',padding:60}}><div style={{fontSize:48}}>✅</div><div style={{fontSize:18,fontWeight:700,marginTop:16}}>Toutes les tâches sont à jour !</div></div>}
    </div>
  )
}
