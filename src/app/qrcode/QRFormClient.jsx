'use client'
import { useState, useEffect, useRef } from 'react'
import PublicPageShell from '@/components/ui/PublicPageShell'

const STEPS = ['Bienvenue', 'Vos informations', 'Finalisation']

const AVAILABILITY_OPTIONS = [
  ['matin', 'Matin'], ['apres_midi', 'Après-midi'], ['soir', 'Soir'],
  ['weekend', 'Week-end'], ['peu_importe', 'Peu importe'],
]

const CONTACT_PREF_OPTIONS = [
  ['whatsapp', 'WhatsApp (recommandé)'],
  ['telephone', 'Téléphone'],
  ['sms', 'SMS'],
  ['email', 'Email'],
  ['none', 'Je préfère ne pas être contacté(e) pour le moment'],
]

const PRAYER_CATEGORY_OPTIONS = [
  ['spirituel', 'Vie spirituelle'], ['famille', 'Famille'], ['sante', 'Santé'],
  ['travail', 'Travail'], ['etudes', 'Études'], ['finances', 'Finances'], ['autre', 'Autre'],
]

const howFoundOptions = ['Bouche a oreille','Reseaux sociaux','Affiche / Publicite',"Invitation d'un ami",'Internet / Google','Radio','Autre']

const PARCOURS_TOKEN_KEY = 'ic_parcours_token'

function isValidEmail(v) { return !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) }
function isValidPhone(v) { return !v || /^[\d\s+().-]{6,}$/.test(v) }

export default function QRFormClient({ welcomeTeam = [] }) {
  const [step, setStep] = useState(0)
  const [sent, setSent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors] = useState({})
  const [token, setToken] = useState(null)
  const initRef = useRef(false)

  const [form, setForm] = useState({
    firstName:'', lastName:'', sex:'F', dateOfBirth:'', phone:'', whatsapp:'', email:'',
    commune:'', quartier:'', address:'', firstVisit:true, salvationCall:false, wantsFI:true,
    howFound:'', prayerRequest:'', parentLastName:'', parentFirstName:'', parentPhone:'', parentEmail:'', parentRelation:'',
    availability:[], contactPreference:'whatsapp', invitedBy:'', cameAlone:false,
    integratorWelcome:'', welcomedByOther:'', prayerCategories:[]
  })
  const isMinor = form.dateOfBirth && new Date(form.dateOfBirth) > new Date(new Date().setFullYear(new Date().getFullYear()-18))

  // Création du parcours dès l'entrée dans le formulaire, ou reprise
  // d'un parcours existant si un token est retrouvé localement (même
  // appareil, onglet rechargé/refermé par erreur). Le stockage local
  // n'est qu'un mécanisme complémentaire : le serveur reste la source
  // principale du parcours.
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    async function init() {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(PARCOURS_TOKEN_KEY) : null
      if (saved) {
        try {
          const res = await fetch(`/api/public/parcours?token=${saved}`)
          if (res.ok) {
            const { data } = await res.json()
            setToken(data.token)
            setForm(prev => ({ ...prev, ...data.form_data }))
            setStep(data.current_step || 0)
            return
          }
        } catch {}
        localStorage.removeItem(PARCOURS_TOKEN_KEY)
      }
      try {
        const res = await fetch('/api/public/parcours', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ formData: {}, currentStep: 0 })
        })
        if (res.ok) {
          const data = await res.json()
          setToken(data.token)
          localStorage.setItem(PARCOURS_TOKEN_KEY, data.token)
        }
      } catch {}
    }
    init()
  }, [])

  // Sauvegarde progressive côté serveur, avec debounce pour ne pas
  // spammer l'API à chaque frappe.
  useEffect(() => {
    if (!token || sent) return
    const t = setTimeout(() => {
      fetch('/api/public/parcours', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, formData: form, currentStep: step })
      }).catch(() => {})
    }, 1200)
    return () => clearTimeout(t)
  }, [form, step, token, sent])

  function toggleArrayField(field, value) {
    setForm(prev => {
      const arr = prev[field]
      return { ...prev, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] }
    })
  }

  function validateStep2() {
    const e = {}
    if (!form.firstName.trim()) e.firstName = 'Le prénom est obligatoire.'
    if (!isMinor && !form.lastName.trim()) e.lastName = 'Le nom est obligatoire.'
    if (!form.dateOfBirth) e.dateOfBirth = 'La date de naissance est obligatoire.'
    if (!form.email.trim()) e.email = "L'adresse email est obligatoire."
    else if (!isValidEmail(form.email)) e.email = 'Cette adresse email ne semble pas valide.'
    if (!isValidPhone(form.phone)) e.phone = 'Ce numéro ne semble pas valide.'
    if (isMinor && !form.parentLastName.trim()) e.parentLastName = 'Le nom du parent est requis pour un mineur.'
    if (isMinor && !isValidPhone(form.parentPhone)) e.parentPhone = 'Le téléphone du parent est requis et doit être valide.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep3() {
    const e = {}
    if (!form.address.trim()) e.address = "L'adresse est obligatoire."
    if (!form.commune.trim()) e.commune = 'La commune est obligatoire.'
    if (!form.integratorWelcome) e.integratorWelcome = "Merci de sélectionner qui vous a accueilli."
    else if (form.integratorWelcome === 'autre' && !form.welcomedByOther.trim()) e.welcomedByOther = 'Merci de préciser le nom de la personne.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit() {
    if (!validateStep3()) return
    setSaving(true)
    setSubmitError('')

    const selectedMember = welcomeTeam.find(p => p.id === form.integratorWelcome)
    const resolvedWelcomedByName = form.integratorWelcome === 'autre'
      ? form.welcomedByOther.trim()
      : (selectedMember?.name || '')

    const payload = {
      ...form,
      invitedBy: form.cameAlone ? 'Je suis venu(e) seul(e).' : form.invitedBy,
      wantsContact: form.contactPreference !== 'none',
      welcomedBy: form.integratorWelcome !== 'autre' ? form.integratorWelcome : null,
      welcomedByName: resolvedWelcomedByName,
      parcoursToken: token,
    }
    try {
      const res = await fetch('/api/public/visitors', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error || "Une erreur est survenue. Merci de réessayer, ou de vous adresser à un membre de l'équipe.")
        setSaving(false)
        return
      }
      if (typeof window !== 'undefined') localStorage.removeItem(PARCOURS_TOKEN_KEY)
      setSent(true)
    } catch (err) {
      setSubmitError("Impossible d'envoyer votre fiche. Vérifiez votre connexion et réessayez.")
    }
    setSaving(false)
  }

  const checkItems = [
    ['firstVisit', "C'est ma premiere visite"],
    ['salvationCall', "J'ai repondu a l'appel au salut"],
    ['wantsFI', "Je veux rejoindre une Famille d'Impact"],
  ]

  if (sent) return (
    <PublicPageShell>
      <div className="auth-shell" style={{background:'linear-gradient(145deg,#072B6A 0%,#0B3D91 100%)'}}>
        <div className="auth-card" style={{textAlign:'center'}}>
          <div className="auth-emoji">🙌</div>
          <div style={{fontSize:22,fontWeight:800,margin:'0 0 8px',color:'var(--n)'}}>
            Merci{form.firstName ? ` ${form.firstName}` : ''} !
          </div>
          <div style={{color:'var(--gd)',fontSize:14,lineHeight:1.6}}>
            Votre fiche a ete enregistree. Un membre de notre equipe vous contactera tres prochainement, selon la preference que vous avez indiquee. Dieu vous benisse !
          </div>
        </div>
      </div>
    </PublicPageShell>
  )

  return (
    <PublicPageShell>
      <style>{`
        @keyframes qrStepIn { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:translateX(0); } }
        .qr-step { animation: qrStepIn .25s ease; }
      `}</style>
      <div className="auth-shell" style={{background:'linear-gradient(145deg,#072B6A 0%,#0B3D91 100%)'}}>
        <div className="auth-card">
          <div style={{textAlign:'center',marginBottom:24}}>
            <div style={{fontSize:24,fontFamily:'Fraunces,serif',fontWeight:700,color:'var(--n)'}}>IMPACT CONNECT</div>
            <div style={{fontSize:13,color:'var(--gy)',marginTop:4}}>Formulaire d&apos;accueil</div>
          </div>
          <div style={{display:'flex',gap:8,marginBottom:20}}>
            {STEPS.map((s,i)=>(
              <div key={i} style={{flex:1,height:4,borderRadius:2,background:i<=step?'var(--n)':'#E2E8F0',transition:'background .3s'}} />
            ))}
          </div>
          <div style={{fontSize:11,color:'var(--gy)',textAlign:'center',marginBottom:18,fontWeight:600,letterSpacing:.5,textTransform:'uppercase'}}>{STEPS[step]}</div>

          {step === 0 && (
            <div className="qr-step" style={{textAlign:'center'}}>
              <div className="auth-emoji">👋</div>
              <div className="auth-title">Ravi de vous accueillir !</div>
              <div style={{fontSize:13,color:'var(--gd)',lineHeight:1.6,marginBottom:20,textAlign:'left'}}>
                Merci d&apos;avoir été parmi nous aujourd&apos;hui. Nous sommes heureux de vous accueillir.
                Ce formulaire nous permettra simplement de mieux vous connaître afin de pouvoir vous accompagner.
              </div>
              <div className="auth-checklist">
                {checkItems.map(([k,l])=>(
                  <label key={k} style={{border:`2px solid ${form[k]?'var(--n)':'var(--br)'}`,background:form[k]?'rgba(11,61,145,.05)':'#F8FAFC'}}>
                    <input type="checkbox" checked={form[k]} onChange={e=>setForm({...form,[k]:e.target.checked})} style={{width:18,height:18,accentColor:'var(--n)',flexShrink:0}} />
                    <span style={{fontSize:13,fontWeight:600}}>{l}</span>
                  </label>
                ))}
              </div>
              <button onClick={()=>setStep(1)} className="auth-cta" style={{background:'var(--n)',marginTop:8}}>Continuer</button>
            </div>
          )}

          {step === 1 && (
            <div className="qr-step">
              <div className="g2">
                <div className="form-group">
                  <label className="form-label">Prenom *</label>
                  <input className="form-input" autoComplete="given-name" name="given-name" value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})} style={errors.firstName ? { borderColor:'var(--re)' } : undefined} />
                  {errors.firstName && <div style={errStyle}>{errors.firstName}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Nom *</label>
                  <input className="form-input" autoComplete="family-name" name="family-name" value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})} style={errors.lastName ? { borderColor:'var(--re)' } : undefined} />
                  {errors.lastName && <div style={errStyle}>{errors.lastName}</div>}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Date de naissance *</label>
                <input type="date" className="form-input" autoComplete="bday" name="bday" value={form.dateOfBirth} onChange={e=>setForm({...form,dateOfBirth:e.target.value})} style={errors.dateOfBirth ? { borderColor:'var(--re)' } : undefined} />
                {errors.dateOfBirth && <div style={errStyle}>{errors.dateOfBirth}</div>}
              </div>
              <div className="form-group"><label className="form-label">Sexe</label>
                <div style={{display:'flex',gap:8}}>
                  {[['F','Femme'],['M','Homme']].map(([v,l])=>(
                    <div key={v} onClick={()=>setForm({...form,sex:v})} style={{flex:1,padding:12,borderRadius:10,border:`2px solid ${form.sex===v?'var(--n)':'var(--br)'}`,background:form.sex===v?'rgba(11,61,145,.08)':'#fff',textAlign:'center',fontSize:13,fontWeight:600,color:form.sex===v?'var(--n)':'#64748B',cursor:'pointer'}}>{l}</div>
                  ))}
                </div>
              </div>
              {isMinor && (
                <div style={{background:'#FFF7ED',border:'1px solid #FED7AA',borderRadius:12,padding:14,marginBottom:14}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#92400E',marginBottom:10}}>Autorisation parentale requise</div>
                  <div className="form-group">
                    <label className="form-label">Nom du parent *</label>
                    <input className="form-input" value={form.parentLastName} onChange={e=>setForm({...form,parentLastName:e.target.value})} style={errors.parentLastName ? { borderColor:'var(--re)' } : undefined} />
                    {errors.parentLastName && <div style={errStyle}>{errors.parentLastName}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Telephone parent *</label>
                    <input className="form-input" value={form.parentPhone} onChange={e=>setForm({...form,parentPhone:e.target.value})} style={errors.parentPhone ? { borderColor:'var(--re)' } : undefined} />
                    {errors.parentPhone && <div style={errStyle}>{errors.parentPhone}</div>}
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Telephone</label>
                <input type="tel" className="form-input" autoComplete="tel" name="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} style={errors.phone ? { borderColor:'var(--re)' } : undefined} />
                {errors.phone && <div style={errStyle}>{errors.phone}</div>}
              </div>
              <div className="form-group"><label className="form-label">WhatsApp (si different)</label><input type="tel" className="form-input" value={form.whatsapp} onChange={e=>setForm({...form,whatsapp:e.target.value})} /></div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input type="email" className="form-input" autoComplete="email" name="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} style={errors.email ? { borderColor:'var(--re)' } : undefined} />
                {errors.email && <div style={errStyle}>{errors.email}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">À quel moment êtes-vous généralement disponible ?</label>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {AVAILABILITY_OPTIONS.map(([v,l])=>(
                    <div key={v} onClick={()=>toggleArrayField('availability',v)} style={{padding:'7px 12px',borderRadius:8,border:`2px solid ${form.availability.includes(v)?'var(--n)':'var(--br)'}`,background:form.availability.includes(v)?'rgba(11,61,145,.08)':'#fff',fontSize:12,fontWeight:600,color:form.availability.includes(v)?'var(--n)':'#64748B',cursor:'pointer'}}>
                      {l}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setStep(0)} className="btn btn-secondary" style={{flex:1}}>Retour</button>
                <button onClick={()=>{ if (validateStep2()) setStep(2) }} className="btn btn-primary" style={{flex:2}}>Continuer</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="qr-step">
              <div className="form-group">
                <label className="form-label">Adresse *</label>
                <input className="form-input" autoComplete="street-address" name="street-address" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Numéro et nom de rue" style={errors.address ? { borderColor:'var(--re)' } : undefined} />
                {errors.address && <div style={errStyle}>{errors.address}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Commune *</label>
                <input className="form-input" autoComplete="address-level2" name="address-level2" value={form.commune} onChange={e=>setForm({...form,commune:e.target.value})} placeholder="ex: Pointe-a-Pitre, Abymes..." style={errors.commune ? { borderColor:'var(--re)' } : undefined} />
                {errors.commune && <div style={errStyle}>{errors.commune}</div>}
              </div>
              <div className="form-group"><label className="form-label">Quartier</label>
                <input className="form-input" value={form.quartier} onChange={e=>setForm({...form,quartier:e.target.value})} />
              </div>
              <div className="form-group"><label className="form-label">Comment nous avez-vous connu ?</label>
                <select className="form-input" value={form.howFound} onChange={e=>setForm({...form,howFound:e.target.value})}>
                  <option value="">Selectionner...</option>
                  {howFoundOptions.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Qui vous a invité aujourd&apos;hui ?</label>
                <input
                  className="form-input"
                  value={form.invitedBy}
                  onChange={e=>setForm({...form,invitedBy:e.target.value})}
                  disabled={form.cameAlone}
                  style={form.cameAlone ? { opacity:.5 } : undefined}
                  placeholder="Prénom et nom"
                />
                <label style={{display:'flex',alignItems:'center',gap:8,marginTop:8,fontSize:13,cursor:'pointer',color:'var(--gd)'}}>
                  <input type="checkbox" checked={form.cameAlone} onChange={e=>setForm({...form,cameAlone:e.target.checked,invitedBy: e.target.checked ? '' : form.invitedBy})} style={{accentColor:'var(--n)'}} />
                  Je suis venu(e) seul(e).
                </label>
              </div>
              <div className="form-group">
                <label className="form-label">Comment préférez-vous être contacté ?</label>
                <div style={{fontSize:12,color:'var(--gy)',marginBottom:8,lineHeight:1.5}}>
                  Un membre de notre équipe pourra vous souhaiter la bienvenue et vous accompagner si vous le souhaitez. Nous respectons votre tranquillité et ne faisons pas de démarchage.
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {CONTACT_PREF_OPTIONS.map(([v,l])=>(
                    <label key={v} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:8,border:`2px solid ${form.contactPreference===v?'var(--n)':'var(--br)'}`,background:form.contactPreference===v?'rgba(11,61,145,.05)':'#fff',cursor:'pointer',fontSize:13}}>
                      <input type="radio" name="contactPreference" checked={form.contactPreference===v} onChange={()=>setForm({...form,contactPreference:v})} style={{accentColor:'var(--n)'}} />
                      {l}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Quels sujets aimeriez-vous que nous portions dans la prière ?</label>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
                  {PRAYER_CATEGORY_OPTIONS.map(([v,l])=>(
                    <div key={v} onClick={()=>toggleArrayField('prayerCategories',v)} style={{padding:'7px 12px',borderRadius:8,border:`2px solid ${form.prayerCategories.includes(v)?'var(--n)':'var(--br)'}`,background:form.prayerCategories.includes(v)?'rgba(11,61,145,.08)':'#fff',fontSize:12,fontWeight:600,color:form.prayerCategories.includes(v)?'var(--n)':'#64748B',cursor:'pointer'}}>
                      {l}
                    </div>
                  ))}
                </div>
                <textarea className="form-input" value={form.prayerRequest} onChange={e=>setForm({...form,prayerRequest:e.target.value})} rows={3} placeholder="Si vous souhaitez préciser..." style={{resize:'vertical'}} />
              </div>

              <div style={{background:'#F0F9FF',border:'1px solid #BAE6FD',borderRadius:12,padding:14,marginTop:6,marginBottom:14}}>
                <div style={{fontSize:12,fontWeight:700,color:'#0369A1',marginBottom:10,textTransform:'uppercase',letterSpacing:.4}}>Zone réservée à l&apos;équipe d&apos;intégration</div>
                <div className="form-group">
                  <label className="form-label">Qui vous a accueilli aujourd&apos;hui ? *</label>
                  <select
                    className="form-input"
                    value={form.integratorWelcome}
                    onChange={e=>setForm({...form,integratorWelcome:e.target.value, welcomedByOther: e.target.value==='autre' ? form.welcomedByOther : ''})}
                    style={errors.integratorWelcome ? { borderColor:'var(--re)' } : undefined}
                  >
                    <option value="">Selectionner...</option>
                    {welcomeTeam.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    <option value="autre">Autre</option>
                  </select>
                  {errors.integratorWelcome && <div style={errStyle}>{errors.integratorWelcome}</div>}
                </div>
                {form.integratorWelcome === 'autre' && (
                  <div className="form-group">
                    <label className="form-label">Nom de la personne ayant accueilli le visiteur *</label>
                    <input className="form-input" value={form.welcomedByOther} onChange={e=>setForm({...form,welcomedByOther:e.target.value})} style={errors.welcomedByOther ? { borderColor:'var(--re)' } : undefined} placeholder="Prénom et nom" />
                    {errors.welcomedByOther && <div style={errStyle}>{errors.welcomedByOther}</div>}
                  </div>
                )}
              </div>

              {submitError && (
                <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#DC2626',fontWeight:500}}>
                  {submitError}
                </div>
              )}
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setStep(1)} className="btn btn-secondary" style={{flex:1}}>Retour</button>
                <button onClick={submit} disabled={saving} className="btn btn-primary" style={{flex:2}}>
                  {saving ? 'Envoi...' : 'Valider ma fiche'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PublicPageShell>
  )
}

const errStyle = { fontSize:11, color:'var(--re)', marginTop:4, fontWeight:500 }
