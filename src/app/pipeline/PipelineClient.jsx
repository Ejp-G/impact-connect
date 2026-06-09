'use client'
import { STAGES, STAGE_LABEL, STAGE_COLOR } from '@/lib/constants'
import { scoreColor } from '@/lib/utils'
const ini = (fn,ln) => ((fn||'')[0]||'')+((ln||'')[0]||'')
export default function PipelineClient({ contacts }) {
  return (
    <div>
      <div style={{fontSize:13,color:'var(--gy)',marginBottom:16}}>{contacts.length} personnes en parcours d'intégration</div>
      <div className="kw">
        {STAGES.map(stage => {
          const sv = contacts.filter(c => c.stage === stage.id)
          return (
            <div key={stage.id} className="kc">
              <div className="kh" style={{background:stage.color}}>
                <div style={{fontSize:18}}>{stage.emoji}</div>
                <div style={{fontSize:10,fontWeight:800,letterSpacing:.5,textTransform:'uppercase'}}>{stage.label}</div>
                <div style={{fontSize:22,fontWeight:800,marginTop:4}}>{sv.length}</div>
              </div>
              {sv.length ? sv.map(c => (
                <div key={c.id} className="kcard" style={{borderLeft:`3px solid ${stage.color}`}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                    <div style={{width:26,height:26,borderRadius:'50%',background:c.sex==='F'?'#8B5CF6':'var(--n)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:9,fontWeight:700,flexShrink:0}}>{ini(c.first_name,c.last_name)}</div>
                    <div><div style={{fontSize:11,fontWeight:700}}>{c.first_name} {c.last_name}</div><div style={{fontSize:10,color:'var(--gy)'}}>{c.commune||'—'}</div></div>
                  </div>
                  <div className="sbr"><div className="sbr-bar"><div className="sbr-fill" style={{width:`${c.integration_score}%`,background:scoreColor(c.integration_score)}} /></div><span className="sbr-val" style={{color:scoreColor(c.integration_score)}}>{c.integration_score}</span></div>
                  {c.alert_level==='red'&&<div style={{marginTop:6,fontSize:10,color:'var(--re)',fontWeight:600}}>🔴 Urgence</div>}
                  {c.agent?.name&&<div style={{marginTop:4,fontSize:10,color:'var(--gd)'}}>👤 {c.agent.name}</div>}
                </div>
              )) : <div style={{padding:16,borderRadius:10,border:'2px dashed var(--br)',textAlign:'center',color:'#CBD5E1',fontSize:12}}>Aucune personne</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
