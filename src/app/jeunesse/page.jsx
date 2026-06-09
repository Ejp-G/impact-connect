import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
export default async function JeunessePage() {
  const supabase = createClient()
  const { data:{ session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
  const { data: mineurs, count } = await supabase.from('contacts')
    .select('id,first_name,last_name,sex,date_of_birth,commune,stage,parental_status,phone,parent_first_name,parent_last_name,parent_phone', { count:'exact' })
    .eq('is_minor', true).neq('status','deleted').order('created_at',{ascending:false})
  const statsByStatus = {
    pending: mineurs?.filter(m=>m.parental_status==='pending').length||0,
    authorized: mineurs?.filter(m=>m.parental_status==='authorized').length||0,
    expired: mineurs?.filter(m=>m.parental_status==='expired').length||0,
  }
  return (
    <AppLayout profile={profile} pageId="jeunesse" title="Module Jeunesse">
      <div style={{maxWidth:1000}}>
        <div className="g3" style={{marginBottom:24}}>
          {[['👶','Total mineurs',count||0,'#0B3D91'],['⏳','En attente',statsByStatus.pending,'#F97316'],['✅','Autorisés',statsByStatus.authorized,'#22C55E']].map(([ic,l,v,c])=>(
            <div key={l} className="card" style={{padding:20,borderTop:`3px solid ${c}`}}>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <div><div style={{fontSize:13,color:'var(--gd)',marginBottom:8}}>{l}</div><div style={{fontSize:32,fontWeight:800}}>{v}</div></div>
                <div style={{width:44,height:44,borderRadius:12,background:c,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{ic}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #F1F5F9',fontWeight:700,fontSize:15}}>Dossiers mineurs</div>
          <table>
            <thead><tr><th>Mineur</th><th>Âge</th><th>Parent</th><th>Contact parent</th><th>Statut autorisation</th><th>Étape</th></tr></thead>
            <tbody>
              {mineurs?.map(m=>{
                const age = m.date_of_birth ? Math.floor((Date.now()-new Date(m.date_of_birth))/(365.25*86400000)) : '?'
                const statusColors = { pending:'#F97316', authorized:'#22C55E', expired:'#EF4444', not_required:'#94A3B8' }
                const statusLabels = { pending:'⏳ En attente', authorized:'✅ Autorisé', expired:'❌ Expiré', not_required:'—' }
                return (
                  <tr key={m.id}>
                    <td><div style={{fontWeight:600,fontSize:13}}>{m.first_name} {m.last_name}</div><div style={{fontSize:11,color:'var(--gy)'}}>{m.commune||'—'}</div></td>
                    <td style={{fontWeight:700,color:'var(--n)'}}>{age} ans</td>
                    <td style={{fontSize:12}}>{m.parent_first_name} {m.parent_last_name}</td>
                    <td style={{fontSize:12,color:'var(--gd)'}}>{m.parent_phone||'—'}</td>
                    <td><span className="badge" style={{background:`${statusColors[m.parental_status]||'#94A3B8'}20`,color:statusColors[m.parental_status]||'#94A3B8'}}>{statusLabels[m.parental_status]||m.parental_status}</span></td>
                    <td style={{fontSize:12,color:'var(--gd)'}}>{m.stage||'visiteur'}</td>
                  </tr>
                )
              })}
              {(!mineurs||mineurs.length===0) && <tr><td colSpan={6} style={{textAlign:'center',padding:32,color:'var(--gy)'}}>Aucun mineur enregistré</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  )
}
