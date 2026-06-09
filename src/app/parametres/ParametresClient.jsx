'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const TABS = [
  { id:'branding',      label:'Marque et Design' },
  { id:'relances',      label:'Relances' },
  { id:'notifications', label:'Notifications' },
  { id:'attribution',   label:'Attribution' },
  { id:'communes',      label:'Communes et FI' },
  { id:'mineurs',       label:'Gestion mineurs' },
]

export default function ParametresClient({ settings, communes, profile }) {
  const [tab, setTab] = useState('branding')
  const [saved, setSaved] = useState(false)
  const [branding, setBranding] = useState(settings.branding || { name1:'IMPACT', name2:'CONNECT', icon:'cross', color:'#0B3D91' })
  const [relances, setRelances] = useState(settings.relances || { j3:true, j7:true, j14:true, j21:true, j30:true, j60:true, j90:true })
  const [notifs, setNotifs] = useState(settings.notifications || { nouveau_visiteur:true, rappel_mardi:true, rapport_hebdo:true })
  const [attribution, setAttribution] = useState(settings.attribution || { method:'round_robin', gender_rule:true })
  const [mineurs, setMineurs] = useState(settings.mineurs || { archivage_j30:true, suppression_j90:true })
  const router = useRouter()
  const isAdmin = profile?.role === 'admin'

  async function saveSettings(key, value) {
    await fetch('/api/settings', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ key, value }) })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    router.refresh()
  }

  const Toggle = ({ checked, onChange }) => (
    <div onClick={onChange} className={`tog ${checked?'on':'off'}`} style={{cursor:'pointer'}}>
      <div className="tog-th" />
    </div>
  )

  const Row = ({ label, desc, children }) => (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0',borderBottom:'1px solid #F1F5F9'}}>
      <div>
        <div style={{fontSize:14,fontWeight:600}}>{label}</div>
        {desc && <div style={{fontSize:12,color:'var(--gy)',marginTop:2}}>{desc}</div>}
      </div>
      <div>{children}</div>
    </div>
  )

  const relanceItems = [
    ['j3',  'J+3 — Premier contact', 'Contact initial dans les 3 jours'],
    ['j7',  'J+7 — Premiere relance', 'Relance une semaine apres la visite'],
    ['j14', 'J+14 — Deuxieme relance', 'Relance a 14 jours'],
    ['j21', 'J+21 — Troisieme relance', 'Alerte orange generee'],
    ['j30', 'J+30 — Derniere relance', 'Alerte rouge generee'],
    ['j60', 'J+60 — Suivi long terme', 'Pour les parcours longs'],
    ['j90', 'J+90 — Archivage', 'Archivage automatique si aucune progression'],
  ]

  const notifItems = [
    ['nouveau_visiteur', 'Nouveau visiteur', 'Notifier les responsables a chaque nouveau visiteur'],
    ['rappel_mardi', 'Rappel du mardi', 'Rappel pilotes FI chaque mardi pour les FI du jeudi'],
    ['rapport_hebdo', 'Rapport hebdomadaire', 'Resume activite chaque lundi matin'],
  ]

  return (
    <div style={{maxWidth:900}}>
      {saved && (
        <div style={{position:'fixed',top:24,right:24,background:'#22C55E',color:'#fff',borderRadius:12,padding:'12px 20px',fontWeight:600,zIndex:9999,boxShadow:'0 4px 20px rgba(34,197,94,.4)'}}>
          Parametres sauvegardes
        </div>
      )}

      <div style={{display:'flex',gap:24}}>
        <div style={{width:200,flexShrink:0}}>
          {TABS.map(t=>(
            <div key={t.id} onClick={()=>setTab(t.id)} style={{padding:'10px 14px',borderRadius:10,cursor:'pointer',marginBottom:4,fontSize:13,fontWeight:tab===t.id?700:500,background:tab===t.id?'var(--n)':'transparent',color:tab===t.id?'#fff':'var(--gd)'}}>
              {t.label}
            </div>
          ))}
        </div>

        <div style={{flex:1}}>

          {tab === 'branding' && (
            <div className="card">
              <div style={{fontSize:16,fontWeight:700,marginBottom:20}}>Marque et Design</div>
              <div className="form-group">
                <label className="form-label">Nom ligne 1</label>
                <input className="form-input" value={branding.name1} onChange={e=>setBranding({...branding,name1:e.target.value})} disabled={!isAdmin} />
              </div>
              <div className="form-group">
                <label className="form-label">Nom ligne 2</label>
                <input className="form-input" value={branding.name2} onChange={e=>setBranding({...branding,name2:e.target.value})} disabled={!isAdmin} />
              </div>
              <div className="form-group">
                <label className="form-label">Couleur principale</label>
                <div style={{display:'flex',gap:12,alignItems:'center'}}>
                  <input type="color" value={branding.color} onChange={e=>setBranding({...branding,color:e.target.value})} disabled={!isAdmin} style={{width:48,height:40,border:'none',borderRadius:8,cursor:'pointer',padding:4}} />
                  <span style={{fontSize:13,color:'var(--gd)',fontFamily:'monospace'}}>{branding.color}</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Icone du logo</label>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {[['cross','Croix'],['dove','Colombe'],['flame','Flamme'],['star','Etoile'],['crown','Couronne']].map(([ic,lb])=>(
                    <div key={ic} onClick={()=>isAdmin&&setBranding({...branding,icon:ic})}
                      style={{padding:'10px 16px',borderRadius:10,border:`2px solid ${branding.icon===ic?'var(--n)':'var(--br)'}`,background:branding.icon===ic?'rgba(11,61,145,.08)':'#fff',cursor:isAdmin?'pointer':'default',fontSize:12,fontWeight:600,color:branding.icon===ic?'var(--n)':'var(--gd)'}}>
                      {lb}
                    </div>
                  ))}
                </div>
              </div>
              {isAdmin && (
                <button onClick={()=>saveSettings('branding',branding)} className="btn btn-primary" style={{marginTop:8}}>
                  Sauvegarder
                </button>
              )}
            </div>
          )}

          {tab === 'relances' && (
            <div className="card">
              <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Relances automatiques</div>
              <div style={{fontSize:13,color:'var(--gy)',marginBottom:20}}>Jalons de suivi automatique pour chaque nouveau visiteur.</div>
              {relanceItems.map(([k,l,d])=>(
                <Row key={k} label={l} desc={d}>
                  <Toggle checked={relances[k]} onChange={()=>{
                    if(!isAdmin) return
                    const n={...relances,[k]:!relances[k]}
                    setRelances(n)
                    saveSettings('relances',n)
                  }} />
                </Row>
              ))}
            </div>
          )}

          {tab === 'notifications' && (
            <div className="card">
              <div style={{fontSize:16,fontWeight:700,marginBottom:20}}>Notifications</div>
              {notifItems.map(([k,l,d])=>(
                <Row key={k} label={l} desc={d}>
                  <Toggle checked={notifs[k]} onChange={()=>{
                    if(!isAdmin) return
                    const n={...notifs,[k]:!notifs[k]}
                    setNotifs(n)
                    saveSettings('notifications',n)
                  }} />
                </Row>
              ))}
            </div>
          )}

          {tab === 'attribution' && (
            <div className="card">
              <div style={{fontSize:16,fontWeight:700,marginBottom:20}}>Regles attribution</div>
              <Row label="Regle H vers H / F vers F" desc="Un homme suivi uniquement par un homme, idem pour les femmes.">
                <div style={{fontSize:12,fontWeight:700,color:'var(--gr)',background:'#F0FDF4',padding:'4px 12px',borderRadius:999}}>
                  Toujours actif
                </div>
              </Row>
              <Row label="Methode de distribution" desc="Comment les contacts sont distribues entre les agents">
                <select className="form-input" value={attribution.method}
                  onChange={e=>{if(!isAdmin)return;const n={...attribution,method:e.target.value};setAttribution(n);saveSettings('attribution',n)}}
                  style={{width:'auto',minWidth:150}} disabled={!isAdmin}>
                  <option value="round_robin">Round Robin (equilibre)</option>
                  <option value="manual">Manuel uniquement</option>
                </select>
              </Row>
            </div>
          )}

          {tab === 'communes' && (
            <div className="card">
              <div style={{fontSize:16,fontWeight:700,marginBottom:20}}>Communes ({communes.length})</div>
              <table>
                <thead><tr><th>Commune</th><th>Secteur</th><th>Statut</th></tr></thead>
                <tbody>
                  {communes.map(c=>(
                    <tr key={c.id}>
                      <td style={{fontWeight:600}}>{c.name}</td>
                      <td style={{fontSize:12,color:'var(--gd)'}}>{c.sector||'—'}</td>
                      <td>
                        <span style={{fontSize:11,background:c.active?'#F0FDF4':'#FEF2F2',color:c.active?'var(--gr)':'var(--re)',padding:'2px 8px',borderRadius:999,fontWeight:600}}>
                          {c.active?'Actif':'Inactif'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'mineurs' && (
            <div className="card">
              <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Gestion des mineurs</div>
              <div style={{fontSize:13,color:'var(--gy)',marginBottom:20}}>Parametres de gestion des dossiers des personnes mineures.</div>
              <Row label="Archivage automatique a J+30" desc="Si autorisation parentale non recue dans les 30 jours, le dossier est archive.">
                <Toggle checked={mineurs.archivage_j30} onChange={()=>{
                  if(!isAdmin) return
                  const n={...mineurs,archivage_j30:!mineurs.archivage_j30}
                  setMineurs(n)
                  saveSettings('mineurs',n)
                }} />
              </Row>
              <Row label="Suppression automatique a J+90" desc="Si dossier archive depuis 90 jours sans autorisation, il est supprime.">
                <Toggle checked={mineurs.suppression_j90} onChange={()=>{
                  if(!isAdmin) return
                  const n={...mineurs,suppression_j90:!mineurs.suppression_j90}
                  setMineurs(n)
                  saveSettings('mineurs',n)
                }} />
              </Row>
              <div style={{marginTop:20,padding:16,background:'#FFF7ED',borderRadius:12,border:'1px solid #FED7AA'}}>
                <div style={{fontSize:13,fontWeight:600,color:'#92400E',marginBottom:8}}>Informations mineurs</div>
                <div style={{fontSize:12,color:'#78350F',lineHeight:1.6}}>
                  Statut immediat : En attente autorisation parentale<br/>
                  Aucune attribution FI ni suivi classique<br/>
                  Relances J+7 et J+14 envoyees au parent<br/>
                  J+30 : archivage automatique si pas de reponse<br/>
                  J+90 : suppression (configurable ci-dessus)
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
