'use client'
import { useRef, useEffect } from 'react'
import { STAGES, STAGE_LABEL, STAGE_COLOR } from '@/lib/constants'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import { Users, UserPlus, Heart, Droplet, Home, BookOpen, Crown, STAGE_ICON_MAP } from '@/lib/icons'

export default function RapportsClient({ stats }) {
  const barRef = useRef(null)
  const barChartInstance = useRef(null)

  useRealtimeRefresh(['contacts'])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { Chart, registerables } = await import('chart.js')
      Chart.register(...registerables)
      if (cancelled) return

      barChartInstance.current?.destroy()

      if (barRef.current) {
        const labels = Object.keys(stats.stageCounts).map(s=>STAGE_LABEL(s))
        const data = Object.values(stats.stageCounts)
        const colors = Object.keys(stats.stageCounts).map(s=>STAGE_COLOR(s))
        barChartInstance.current = new Chart(barRef.current, {
          type:'bar',
          data:{ labels, datasets:[{ data, backgroundColor:colors.map(c=>c+'80'), borderColor:colors, borderWidth:1.5, borderRadius:6 }] },
          options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}},y:{grid:{color:'#F1F5F9'},ticks:{stepSize:1}}} }
        })
      }
    }
    load()

    return () => {
      cancelled = true
      barChartInstance.current?.destroy()
    }
  }, [stats])

  const rate = stats.totalActive > 0 ? Math.round((stats.integrated / stats.totalActive) * 100) : 0

  const statCards = [
    { Icon: Users, label: 'Total actifs', value: stats.totalActive, color: '#0B3D91' },
    { Icon: UserPlus, label: 'Ce mois', value: stats.monthNew, color: '#22C55E' },
    { Icon: Heart, label: 'Appels au salut', value: stats.salvations, color: '#F97316' },
    { Icon: Droplet, label: 'Baptisés', value: stats.baptisms, color: '#8B5CF6' },
  ]

  const integrationBlocks = [
    { Icon: Home, label: "Intégrés FI", key: 'integre' },
    { Icon: BookOpen, label: 'En parcours', key: 'parcours' },
    { Icon: Droplet, label: 'Baptisés', key: 'bapteme' },
    { Icon: Crown, label: 'Leaders', key: 'leader' },
  ]

  return (
    <div style={{maxWidth:1100}}>
      <div className="g4" style={{marginBottom:24}}>
        {statCards.map(({ Icon, label, value, color }) => (
          <div key={label} className="card" style={{padding:20,borderTop:`3px solid ${color}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div><div style={{fontSize:13,color:'var(--gd)',marginBottom:8}}>{label}</div><div style={{fontSize:32,fontWeight:800,color:'#1E293B'}}>{value||0}</div></div>
              <div style={{width:44,height:44,borderRadius:12,background:color,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon size={20} strokeWidth={2} color="#fff" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="g2" style={{marginBottom:24}}>
        <div className="card">
          <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>Répartition par étape</div>
          <div style={{fontSize:12,color:'var(--gy)',marginBottom:16}}>Nombre de personnes dans chaque étape du pipeline</div>
          <div style={{height:250}}><canvas ref={barRef} /></div>
        </div>
        <div className="card">
          <div style={{fontSize:15,fontWeight:700,marginBottom:16}}>Taux d'intégration</div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:200}}>
            <div style={{fontSize:72,fontWeight:900,color:'var(--n)',letterSpacing:-4}}>{rate}%</div>
            <div style={{fontSize:14,color:'var(--gy)',marginTop:8}}>des visiteurs sont intégrés</div>
            <div style={{fontSize:12,color:'var(--gy)',marginTop:4}}>{stats.integrated||0} / {stats.totalActive||0} personnes</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:8}}>
            {integrationBlocks.map(({ Icon, label, key }) => (
              <div key={key} style={{background:'#F8FAFC',borderRadius:10,padding:'10px 12px'}}>
                <div style={{fontSize:11,color:'var(--gd)',display:'flex',alignItems:'center',gap:6}}>
                  <Icon size={13} strokeWidth={2} /> {label}
                </div>
                <div style={{fontSize:22,fontWeight:800,color:STAGE_COLOR(key)}}>{stats.stageCounts?.[key]||0}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{fontSize:15,fontWeight:700,marginBottom:16}}>Pipeline complet</div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {STAGES.map(s=>{
            const count = stats.stageCounts?.[s.id]||0
            const pct = stats.totalActive ? Math.round((count/stats.totalActive)*100) : 0
            const StageIcon = STAGE_ICON_MAP[s.id]
            return (
              <div key={s.id} style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:24,display:'flex',justifyContent:'center'}}>
                  {StageIcon && <StageIcon size={15} strokeWidth={2} color={s.color} />}
                </div>
                <div style={{width:140,fontSize:12,fontWeight:600,color:'var(--gd)'}}>{s.label}</div>
                <div style={{flex:1,height:20,background:'#F1F5F9',borderRadius:4,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pct}%`,background:s.color,borderRadius:4,display:'flex',alignItems:'center',paddingLeft:8,minWidth:pct>0?40:0}}>
                    {pct>8&&<span style={{fontSize:10,fontWeight:700,color:'#fff'}}>{pct}%</span>}
                  </div>
                </div>
                <div style={{width:36,fontSize:13,fontWeight:700,textAlign:'right',color:s.color}}>{count}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
