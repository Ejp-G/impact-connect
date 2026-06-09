'use client'
import { useEffect, useRef } from 'react'
import { STAGES, STAGE_LABEL, STAGE_COLOR } from '@/lib/constants'

export default function DashboardClient({ stats, profile }) {
  const areaRef = useRef(null)
  const pieRef = useRef(null)

  useEffect(() => {
    const loadCharts = async () => {
      const { Chart, registerables } = await import('chart.js')
      Chart.register(...registerables)

      if (areaRef.current) {
        new Chart(areaRef.current, {
          type:'line',
          data:{
            labels:['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'],
            datasets:[
              { label:'Visiteurs', data:[12,19,15,22,18,25,20,23,28,32,38,45], borderColor:'#0B3D91', backgroundColor:'rgba(11,61,145,.08)', fill:true, tension:.4, borderWidth:2 },
              { label:'Intégrations', data:[4,7,6,9,8,11,9,10,13,15,18,22], borderColor:'#22C55E', backgroundColor:'rgba(34,197,94,.05)', fill:true, tension:.4, borderWidth:2 },
            ]
          },
          options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{font:{size:11}}}}, scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{grid:{color:'#F1F5F9'},ticks:{font:{size:10}}}}}
        })
      }

      if (pieRef.current) {
        const pieData = Object.entries(stats.stageCounts||{}).slice(0,6)
        new Chart(pieRef.current, {
          type:'doughnut',
          data:{ labels:pieData.map(([s])=>STAGE_LABEL(s)), datasets:[{ data:pieData.map(([,v])=>v), backgroundColor:pieData.map(([s])=>STAGE_COLOR(s)), borderWidth:0 }] },
          options:{ responsive:true, maintainAspectRatio:false, cutout:'65%', plugins:{legend:{display:false}} }
        })
      }
    }
    loadCharts()
  }, [])

  const firstName = profile?.name?.split(' ')[0] || 'Pasteur'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, maxWidth:1200 }}>
      {/* Hero */}
      <div style={{ background:'linear-gradient(135deg,#072B6A 0%,#0B3D91 60%,#1452B5 100%)', borderRadius:20, padding:'28px 32px', color:'#fff', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', border:'1px solid rgba(255,255,255,.08)' }} />
        <div style={{ fontSize:22, fontWeight:800, marginBottom:6 }}>Bonjour, {firstName} ! 👋</div>
        <div style={{ fontSize:14, opacity:.7, marginBottom:20 }}>Voici un résumé de l'activité de votre église.</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {[
            ['Visiteurs ce mois', stats.newThisMonth || 0, '↑'],
            ['Intégrations', stats.stageCounts?.integre || 0, '↑'],
            ['Appels au salut', stats.salvations || 0, '↑'],
            ['Tâches en attente', stats.pendingTasks || 0, ''],
          ].map(([lb,v,ch])=>(
            <div key={lb} style={{ background:'rgba(255,255,255,.1)', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ fontSize:11, opacity:.7, marginBottom:4, fontWeight:500 }}>{lb}</div>
              <div style={{ fontSize:26, fontWeight:800, letterSpacing:'-.5px' }}>{v}</div>
              {ch && <div style={{ fontSize:11, color:'#86EFAC', marginTop:2 }}>{ch} ce mois</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="g4">
        {[
          ['👥', 'Total contacts', stats.totalContacts || 0, '#0B3D91'],
          ['🏠', "Familles d'Impact", stats.fiData?.length || 0, '#22C55E'],
          ['🔴', 'Alertes urgentes', stats.alertsRed || 0, '#EF4444'],
          ['✅', 'Tâches en attente', stats.pendingTasks || 0, '#F97316'],
        ].map(([ic,lb,v,co])=>(
          <div key={lb} className="card" style={{ padding:20, borderTop:`3px solid ${co}`, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, right:0, width:80, height:80, borderRadius:'0 16px 0 80px', background:co+'10' }} />
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:13, color:'#64748B', fontWeight:500, marginBottom:8 }}>{lb}</div>
                <div style={{ fontSize:32, fontWeight:800, color:'#1E293B', letterSpacing:-1 }}>{v}</div>
              </div>
              <div style={{ width:44, height:44, borderRadius:12, background:co, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{ic}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="g2r">
        <div className="card">
          <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>Croissance annuelle</div>
          <div style={{ fontSize:12, color:'var(--gy)', marginBottom:16 }}>Visiteurs et intégrations</div>
          <div style={{ height:220 }}><canvas ref={areaRef} /></div>
        </div>
        <div className="card">
          <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>Répartition Pipeline</div>
          <div style={{ fontSize:12, color:'var(--gy)', marginBottom:12 }}>Par étape</div>
          <div style={{ height:160 }}><canvas ref={pieRef} /></div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 10px', marginTop:10 }}>
            {Object.entries(stats.stageCounts||{}).map(([stage, count])=>(
              <div key={stage} style={{ display:'flex', alignItems:'center', gap:4 }}>
                <div style={{ width:8, height:8, borderRadius:2, background:STAGE_COLOR(stage) }} />
                <span style={{ fontSize:11, color:'var(--gd)' }}>{STAGE_LABEL(stage)} ({count})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FI Overview */}
      <div className="card">
        <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>🏠 Familles d'Impact — Capacité</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          {stats.fiData?.map(fi => {
            const mb = stats.fiMemberCounts?.[fi.id] || 0
            const pct = Math.round((mb / fi.capacity) * 100)
            return (
              <div key={fi.id} style={{ padding:'12px 16px', background:'#F8FAFC', borderRadius:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>{fi.name}</span>
                  <span style={{ fontSize:12, color:pct>85?'var(--or)':'var(--gr)', fontWeight:700 }}>{mb}/{fi.capacity}</span>
                </div>
                <div style={{ height:6, background:'#E2E8F0', borderRadius:3 }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:pct>85?'var(--or)':'var(--gr)', borderRadius:3, transition:'width .5s' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
