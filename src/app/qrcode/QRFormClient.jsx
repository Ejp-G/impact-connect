'use client'
import { useState } from 'react'

const STEPS = ['Bienvenue','Vos informations','Finalisation']

export default function QRFormClient() {
  const [step, setStep] = useState(0)
  const [sent, setSent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ firstName:'',lastName:'',sex:'F',dateOfBirth:'',phone:'',whatsapp:'',email:'',commune:'',quartier:'',firstVisit:true,salvationCall:false,wantsContact:true,wantsFI:true,howFound:'',prayerRequest:'',parentLastName:'',parentFirstName:'',parentPhone:'',parentEmail:'',parentRelation:'' })

  const isMinor = form.dateOfBirth && new Date(form.dateOfBirth) > new Date(new Date().setFullYear(new Date().getFullYear()-18))

  async function submit() {
    setSaving(true)
    await fetch('/api/visitors', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
    setSaving(false)
    setSent(true)
  }

  if (sent) return (
    <div style={{minHeight:'100vh',background:'linear-gradient(145deg,#072B6A 0%,#0B3D91 100%)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{background:'#fff',borderRadius:24,padding:48,textAlign:'center',maxWidth:400}}>
        <div style={{fontSize:64}}>🙌</div>
        <div style={{fontSize:24,fontWeight:800,margin:'16px 0 8px',color:'var(--n)'}}>Bienvenue !</div>
        <div style={{color:'var(--gd)',fontSize:14,lineHeight:1.6}}>Votre fiche a été enregistrée. Un membre de notre équipe vous contactera très prochainement. Dieu vous bénisse !</div>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(145deg,#072B6A 0%,#0B3D91 100%)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{background:'#fff',borderRadius:24,padding:'32px 28px',width:'100%',maxWidth:440}}>
        {/* Header */}
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:28,fontFamily:'Fraunces,serif',fontWeight:700,color:'var(--n)'}}>IMPACT CONNECT</div>
          <div style={{fontSize:13,color:'var(--gy)',marginTop:4}}>Formulaire d'accueil</div>
        </div>

        {/* Progress */}
        <div style={{display:'flex',gap:8,marginBottom:28}}>
          {STEPS.map((s,i)=>(
            <div key={i} style={{flex:1,height:4,borderRadius:2,background:i<=step?'var(--n)':'#E2E8F0',transition:'background .3s'}} />
          ))}
        </div>
        <div style={{fontSize:11,color:'var(--gy)',textAlign:'center',marginBottom:20,fontWeight:600,letterSpacing:.5,textTransform:'uppercase'}}>{STEPS[step]}</div>

        {step === 0 && (
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:48,marginBottom:16}}>👋</div>
            <div style={{fontSize:18,fontWeight:700,marginBottom:12}}>Ravi de vous accueillir !</div>
            <div style={{fontSize:13,color:'var(--gd)',lineHeight:1.6,marginBottom:28}}>Ce formulaire nous permettra de mieux vous connaître et de vous accompagner dans votre parcours de foi. Cela prend moins de 2 minutes.</div>
            <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:28}}>
              {[['firstVisit','C'est ma première visite','👋'],['salvationCall','J'ai répondu à l'appel au salut','🙌'],['wantsContact','Je souhaite être contacté','📞'],['wantsFI','Je veux rejoindre une Famille d'Impact','🏠']].map(([k,l,ic])=>(
                <label key={k} style={{display:'flex',alignItems:'center',gap:12,padding:12,borderRadius:12,border:`2px solid ${form[k]?'var(--n)':'var(--br)'}`,background:form[k]?'rgba(11,61,145,.05)':'#F8FAFC',cursor:'pointer'}}>
                  <input type="checkbox" checked={form[k]} onChange={e=>setForm({...form,[k]:e.target.checked})} style={{width:18,height:18,accentColor:'var(--n)'}} />
                  <span style={{fontSize:14}}>{ic}</span>
                  <span style={{fontSize:13,fontWeight:600}}>{l}</span>
                </label>
              ))}
            </div>
            <button onClick={()=>setStep(1)} className="btn btn-primary" style={{width:'100%',padding:14}}>Continuer →</button>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="g2">
              <div className="form-group"><label className="form-label">Prénom *</label><input className="form-input" value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})} /></div>
              <div className="form-group"><label className="form-label">Nom *</label><input className="form-input" value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})} /></div>
            </div>
            <div className="form-group"><label className="form-label">Date de naissance</label><input type="date" className="form-input" value={form.dateOfBirth} onChange={e=>setForm({...form,dateOfBirth:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Sexe</label>
              <div style={{display:'flex',gap:8}}>
                {[['F','👩 Femme'],['M','👨 Homme']].map(([v,l])=>(
                  <div key={v} onClick={()=>setForm({...form,sex:v})} style={{flex:1,padding:12,borderRadius:10,border:`2px solid ${form.sex===v?'var(--n)':'var(--br)'}`,background:form.sex===v?'rgba(11,61,145,.08)':'#fff',textAlign:'center',fontSize:13,fontWeight:600,color:form.sex===v?'var(--n)':'#64748B',cursor:'pointer'}}>{l}</div>
                ))}
              </div>
            </div>
            {isMinor && <div style={{background:'#FFF7ED',border:'1px solid #FED7AA',borderRadius:12,padding:16,marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,color:'#92400E',marginBottom:12}}>👶 Autorisation parentale requise</div>
              <div className="form-group"><label className="form-label">Nom du parent *</label><input className="form-input" value={form.parentLastName} onChange={e=>setForm({...form,parentLastName:e.target.value})} /></div>
              <div className="form-group"><label className="form-label">Téléphone parent *</label><input className="form-input" value={form.parentPhone} onChange={e=>setForm({...form,parentPhone:e.target.value})} /></div>
            </div>}
            <div className="form-group"><label className="form-label">Téléphone</label><input type="tel" className="form-input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setStep(0)} className="btn btn-secondary" style={{flex:1}}>← Retour</button>
              <button onClick={()=>form.firstName&&form.lastName?setStep(2):alert('Prénom et nom obligatoires')} className="btn btn-primary" style={{flex:2}}>Continuer →</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="form-group"><label className="form-label">Commune</label>
              <input className="form-input" value={form.commune} onChange={e=>setForm({...form,commune:e.target.value})} placeholder="ex: Pointe-à-Pitre, Abymes…" />
            </div>
            <div className="form-group"><label className="form-label">Quartier</label>
              <input className="form-input" value={form.quartier} onChange={e=>setForm({...form,quartier:e.target.value})} />
            </div>
            <div className="form-group"><label className="form-label">Comment nous avez-vous connu ?</label>
              <select className="form-input" value={form.howFound} onChange={e=>setForm({...form,howFound:e.target.value})}>
                <option value="">Sélectionner…</option>
                {['Bouche à oreille','Réseaux sociaux','Affiche / Publicité','Invitation d'un ami','Internet / Google','Radio','Autre'].map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Demande de prière (facultatif)</label>
              <textarea className="form-input" value={form.prayerRequest} onChange={e=>setForm({...form,prayerRequest:e.target.value})} rows={3} placeholder="Partagez votre demande…" style={{resize:'vertical'}} />
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setStep(1)} className="btn btn-secondary" style={{flex:1}}>← Retour</button>
              <button onClick={submit} disabled={saving} className="btn btn-primary" style={{flex:2}}>
                {saving?'⏳ Envoi…':'🙌 Valider ma fiche'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
