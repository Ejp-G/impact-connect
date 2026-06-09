'use client'
export default function FIClient({ fis, profile }) {
  const isAdmin = ['admin'].includes(profile?.role)
  return (
    <div style={{maxWidth:1100}}>
      <div className="g3">
        {fis.map(fi => {
          const pct = Math.round((fi.memberCount / fi.capacity) * 100)
          return (
            <div key={fi.id} className="card" style={{cursor:'pointer',overflow:'hidden',padding:0}}>
              <div style={{padding:'20px 20px 44px',background:'linear-gradient(135deg,var(--nd) 0%,var(--n) 100%)',color:'#fff',position:'relative',overflow:'hidden'}}>
                <div style={{position:'absolute',right:-20,top:-20,width:100,height:100,borderRadius:'50%',border:'2px solid rgba(255,255,255,.1)'}} />
                <div style={{fontSize:10,opacity:.7,letterSpacing:1,fontWeight:600,textTransform:'uppercase'}}>{fi.commune_name}</div>
                <div style={{fontSize:20,fontWeight:800,marginTop:4}}>{fi.name}</div>
                <div style={{marginTop:8,display:'flex',gap:6}}>
                  <span style={{fontSize:10,background:'rgba(255,255,255,.2)',padding:'2px 8px',borderRadius:999}}>{fi.status==='active'?'✅ Active':'🔄 En développement'}</span>
                </div>
              </div>
              <div style={{padding:20,marginTop:-24,position:'relative',zIndex:1}}>
                <div style={{background:'#fff',borderRadius:12,padding:'14px 16px',marginBottom:14,boxShadow:'0 2px 8px rgba(0,0,0,.08)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                    <span style={{fontSize:12,color:'var(--gd)'}}>Capacité</span>
                    <span style={{fontSize:12,fontWeight:700,color:pct>85?'var(--or)':'var(--gr)'}}>{fi.memberCount}/{fi.capacity}</span>
                  </div>
                  <div style={{height:8,background:'#F1F5F9',borderRadius:4,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${pct}%`,background:pct>85?'var(--or)':'var(--gr)',borderRadius:4}} />
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}><span>👤</span><span style={{fontSize:12}}>Pilote : <b>{fi.pilot?.name||'—'}</b></span></div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}><span>📅</span><span style={{fontSize:12}}>{fi.day} à {fi.time}</span></div>
                </div>
              </div>
            </div>
          )
        })}
        {isAdmin && (
          <div className="card" style={{border:'2px dashed #CBD5E1',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:40,cursor:'pointer',minHeight:200}}>
            <div style={{fontSize:36,marginBottom:12}}>✚</div>
            <div style={{fontSize:14,fontWeight:700,color:'#374151'}}>Ouvrir une nouvelle FI</div>
          </div>
        )}
      </div>
    </div>
  )
}
