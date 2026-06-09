import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
export default async function JournalPage() {
  const supabase = createClient()
  const { data:{ session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
  const { data: logs } = await supabase.from('audit_log')
    .select('*,user:profiles!audit_log_performed_by_fkey(name)').order('created_at',{ascending:false}).limit(200)
  const icons = {'Creation visiteur':'👤','Changement stage':'🔀','Attribution agent auto':'👥','Attribution FI automatique':'🏠'}
  return (
    <AppLayout profile={profile} pageId="journal" title="Journal d'activité">
      <div style={{maxWidth:900}}>
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #F1F5F9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:15,fontWeight:700}}>Journal d'activité</div>
            <div style={{fontSize:12,color:'var(--gy)'}}>{logs?.length||0} événements</div>
          </div>
          <div style={{padding:20,display:'flex',flexDirection:'column',gap:0}}>
            {logs?.map((log,i)=>(
              <div key={log.id} style={{display:'flex',gap:16,paddingBottom:16,position:'relative'}}>
                {i < logs.length-1 && <div style={{position:'absolute',left:20,top:36,bottom:0,width:2,background:'#F1F5F9'}} />}
                <div style={{width:40,height:40,borderRadius:12,background:'#EFF6FF',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0,zIndex:1}}>
                  {icons[log.action]||'📝'}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600}}>{log.action}</div>
                  <div style={{fontSize:12,color:'var(--gd)',marginTop:2}}>
                    Par {log.user?.name||'Système'} • {new Date(log.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </div>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <div style={{marginTop:6,padding:'6px 10px',background:'#F8FAFC',borderRadius:8,fontSize:11,color:'#64748B',fontFamily:'monospace'}}>
                      {JSON.stringify(log.details)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {(!logs||logs.length===0) && <div style={{textAlign:'center',padding:40,color:'var(--gy)'}}>Aucune activité enregistrée</div>}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
