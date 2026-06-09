import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
export default async function CartePage() {
  const supabase = createClient()
  const { data:{ session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
  const { data: byCommune } = await supabase.from('contacts').select('commune').eq('status','active')
  const counts = {}
  byCommune?.forEach(c=>{ if(c.commune) counts[c.commune]=(counts[c.commune]||0)+1 })
  return (
    <AppLayout profile={profile} pageId="carte" title="Carte Guadeloupe">
      <div style={{maxWidth:1100}}>
        <div className="g2" style={{marginBottom:24}}>
          <div className="card">
            <div style={{fontSize:15,fontWeight:700,marginBottom:16}}>🗺️ Répartition géographique</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {Object.entries(counts).sort(([,a],[,b])=>b-a).map(([commune,count])=>{
                const max = Math.max(...Object.values(counts))
                return (
                  <div key={commune} style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:120,fontSize:12,fontWeight:600,color:'var(--gd)',textAlign:'right'}}>{commune}</div>
                    <div style={{flex:1,height:24,background:'#F1F5F9',borderRadius:6,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${(count/max)*100}%`,background:'var(--n)',borderRadius:6,display:'flex',alignItems:'center',paddingLeft:8}}>
                        <span style={{fontSize:11,fontWeight:700,color:'#fff'}}>{count}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              {Object.keys(counts).length===0 && <div style={{textAlign:'center',color:'var(--gy)',padding:32}}>Aucune donnée géographique</div>}
            </div>
          </div>
          <div className="card">
            <div style={{fontSize:15,fontWeight:700,marginBottom:12}}>📊 Par commune</div>
            <table>
              <thead><tr><th>Commune</th><th>Personnes</th><th>%</th></tr></thead>
              <tbody>
                {Object.entries(counts).sort(([,a],[,b])=>b-a).map(([c,n])=>{
                  const total = Object.values(counts).reduce((a,b)=>a+b,0)
                  return <tr key={c}><td style={{fontWeight:600}}>{c}</td><td style={{fontWeight:700,color:'var(--n)'}}>{n}</td><td style={{fontSize:12,color:'var(--gy)'}}>{Math.round((n/total)*100)}%</td></tr>
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card" style={{textAlign:'center',padding:40,background:'linear-gradient(135deg,#F8FAFC,#EFF6FF)'}}>
          <div style={{fontSize:40}}>🗺️</div>
          <div style={{fontSize:16,fontWeight:700,marginTop:12,color:'var(--n)'}}>Carte interactive disponible avec Google Maps API</div>
          <div style={{fontSize:13,color:'var(--gy)',marginTop:8,maxWidth:500,margin:'12px auto'}}>Intégrez votre clé Google Maps API dans les paramètres pour visualiser la carte interactive de Guadeloupe avec la position de chaque FI et visiteur.</div>
        </div>
      </div>
    </AppLayout>
  )
}
