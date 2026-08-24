'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Calendar, RefreshCw, Copy, Download, UserX, Plus, X, Check } from 'lucide-react'

const MONTH_NAMES_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function currentMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}
function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
}
function eligibleRole(p) {
  return ['equipe_accueil','equipe_suivi'].includes(p.role)
    || (p.secondary_roles||[]).some(r => ['equipe_accueil','equipe_suivi'].includes(r))
}

export default function PlanningClient({ profile, postTypes, allProfiles }) {
  const [month, setMonth] = useState(currentMonthStr())
  const [planning, setPlanning] = useState(null)
  const [sundays, setSundays] = useState([])
  const [mondays, setMondays] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showUnavail, setShowUnavail] = useState(false)
  const [unavailList, setUnavailList] = useState([])
  const [unavailPick, setUnavailPick] = useState('')
  const [unavailReason, setUnavailReason] = useState('')
  const [showAddPost, setShowAddPost] = useState(false)
  const [newPost, setNewPost] = useState({ name:'', emoji:'', default_slots:1 })
  const [postTypesList, setPostTypesList] = useState(postTypes)
  const [copySuccess, setCopySuccess] = useState(false)
  const canvasRef = useRef(null)

  const canEdit = ['admin','responsable_suivi','responsable_integration'].includes(profile?.role)
  const eligiblePeople = allProfiles.filter(eligibleRole)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/planning?month=${month}`)
    const data = await res.json()
    setPlanning(data.planning)
    setSundays(data.sundays || [])
    setMondays(data.mondays || [])
    setLoading(false)
  }, [month])

  const loadUnavail = useCallback(async () => {
    const res = await fetch(`/api/planning/unavailability?month=${month}`)
    const data = await res.json()
    setUnavailList(data.unavailability || [])
  }, [month])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (showUnavail) loadUnavail() }, [showUnavail, loadUnavail])

  async function generate() {
    if (planning && !confirm('Un planning existe déjà pour ce mois — le régénérer effacera les assignations actuelles. Continuer ?')) return
    setGenerating(true)
    const monthLabel = `${MONTH_NAMES_FR[Number(month.slice(5,7))-1]} ${month.slice(0,4)}`
    await fetch('/api/planning', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ month, title: `Planning Accueil & Intégration — ${monthLabel}` })
    })
    setGenerating(false)
    await load()
  }

  async function updateAssignment(table, id, profileId, customName) {
    await fetch('/api/planning/assignment', {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ table, id, profile_id: profileId, custom_name: customName })
    })
    await load()
  }

  async function addUnavailability() {
    if (!unavailPick) return
    await fetch('/api/planning/unavailability', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ profile_id: unavailPick, month, reason: unavailReason })
    })
    setUnavailPick(''); setUnavailReason('')
    await loadUnavail()
  }
  async function removeUnavailability(id) {
    await fetch('/api/planning/unavailability', {
      method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id })
    })
    await loadUnavail()
  }

  async function addPostType() {
    if (!newPost.name.trim()) return
    await fetch('/api/planning/post-types', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ ...newPost, sort_order: postTypesList.length + 1 })
    })
    setShowAddPost(false)
    setNewPost({ name:'', emoji:'', default_slots:1 })
    window.location.reload() // simple : recharge pour récupérer la nouvelle liste server-side
  }

  function personName(a) {
    return a.profile?.name || a.custom_name || '—'
  }

  // Génère le texte WhatsApp dans le format exact utilisé actuellement
  function buildWhatsappText() {
    if (!planning) return ''
    const monthLabel = `${MONTH_NAMES_FR[Number(month.slice(5,7))-1]} ${month.slice(0,4)}`
    let text = `Bonjour la Team !\n\nJe crois que vous allez tous très bien par Sa grâce 🙏🏽✨\n\nVoici le Planning Accueil & Intégration pour le mois *d'${monthLabel}*\n\nSuite à la fusion des deux départements, chaque membre pourra désormais servir sur les différents pôles selon le planning établi.\n\n⸻\n\n`

    sundays.forEach((sunday, idx) => {
      text += `*Dimanche ${formatDateShort(sunday.date)} (${sunday.culte_label || 'CDJP'})*\n\n`
      const byPost = {}
      ;(sunday.assignments || []).forEach(a => {
        const key = a.post_type?.id
        ;(byPost[key] = byPost[key] || { post: a.post_type, names: [] }).names.push(personName(a))
      })
      Object.values(byPost)
        .sort((a,b) => (a.post?.sort_order||0) - (b.post?.sort_order||0))
        .forEach(({ post, names }) => {
          text += `• ${post?.emoji || ''} ${post?.name || ''} : ${names.map(n => '@' + n).join(', ')}\n`
        })

      const monday = mondays[idx]
      if (monday) {
        text += `\n*Lundi ${formatDateShort(monday.date)} (Temps de prière – 19h)*\n\n`
        ;(monday.prayer || []).forEach(p => {
          text += `🙇🏽‍♀️@${personName(p)} (${p.duration_minutes || 20}min)\n`
        })
        text += `\nRépartition Phoning ☎️\n\n`
        ;(monday.phoning || []).forEach(p => { text += `📞@${personName(p)}\n` })
      }
      text += `\n⸻\n\n`
    })

    text += `📝 Remarque\n\nCette nouvelle organisation permet à l'Accueil et à l'Intégration d'avancer ensemble afin d'offrir un meilleur accompagnement aux personnes qui nous rejoignent.\n\nLes plannings mensuels seront envoyés au début de chaque mois afin que vous puissiez vous organiser pour le service.\n\nPour ceux qui ne pourront pas servir, merci de trouver quelqu'un qui pourra vous remplacer.\n\nStay Bless 🙏🏽✨`

    return text
  }

  const [editableText, setEditableText] = useState('')
  useEffect(() => { setEditableText(buildWhatsappText()) }, [sundays, mondays, planning]) // eslint-disable-line

  function copyText() {
    navigator.clipboard.writeText(editableText)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  // Génère une image PNG du planning via Canvas 2D (pas de dépendance
  // externe) — rendu simple mais lisible, adapté au partage WhatsApp.
  function downloadImage() {
    const lines = editableText.split('\n')
    const width = 900
    const lineHeight = 26
    const padding = 40
    const height = padding * 2 + lines.length * lineHeight
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#0B3D91'
    ctx.fillRect(0, 0, width, 70)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 22px Arial'
    ctx.fillText('EJP Guadeloupe — Planning Accueil & Intégration', padding, 44)
    ctx.fillStyle = '#1E293B'
    ctx.font = '15px Arial'
    let y = 100
    lines.forEach(line => {
      const isTitle = line.startsWith('*') 
      ctx.font = isTitle ? 'bold 16px Arial' : '14px Arial'
      ctx.fillStyle = isTitle ? '#0B3D91' : '#1E293B'
      ctx.fillText(line.replace(/\*/g, ''), padding, y)
      y += lineHeight
    })
    const link = document.createElement('a')
    link.download = `planning_${month}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fff', border:'1px solid #E2E8F0', borderRadius:10, padding:'8px 14px' }}>
          <Calendar size={15} strokeWidth={2} color="#94A3B8" />
          <input type="month" value={month.slice(0,7)} onChange={e => setMonth(e.target.value + '-01')}
            style={{ border:'none', outline:'none', fontFamily:'inherit', fontSize:13 }} />
        </div>
        {canEdit && (
          <>
            <button onClick={generate} disabled={generating} style={btnPrimary}>
              <RefreshCw size={14} strokeWidth={2} /> {generating ? 'Génération...' : planning ? 'Régénérer' : 'Générer automatiquement'}
            </button>
            <button onClick={() => setShowUnavail(true)} style={btnSecondary}>
              <UserX size={14} strokeWidth={2} /> Indisponibilités
            </button>
            <button onClick={() => setShowAddPost(true)} style={btnSecondary}>
              <Plus size={14} strokeWidth={2} /> Ajouter un poste
            </button>
          </>
        )}
      </div>

      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:'#94A3B8' }}>Chargement…</div>
      ) : !planning ? (
        <div style={{ padding:40, textAlign:'center', color:'#94A3B8', background:'#F8FAFC', borderRadius:14 }}>
          Aucun planning pour ce mois. {canEdit ? 'Clique sur "Générer automatiquement" pour commencer.' : ''}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {sundays.map((sunday, idx) => {
            const monday = mondays[idx]
            const byPost = {}
            ;(sunday.assignments || []).forEach(a => {
              const key = a.post_type?.id
              ;(byPost[key] = byPost[key] || { post: a.post_type, items: [] }).items.push(a)
            })
            return (
              <div key={sunday.id} className="card" style={{ padding:18 }}>
                <div style={{ fontWeight:800, fontSize:14, marginBottom:12, color:'#0B3D91' }}>
                  Dimanche {formatDateShort(sunday.date)} ({sunday.culte_label})
                </div>
                {Object.values(byPost).sort((a,b) => (a.post?.sort_order||0)-(b.post?.sort_order||0)).map(({ post, items }) => (
                  <div key={post?.id} style={{ marginBottom:8, fontSize:13 }}>
                    <b>{post?.emoji} {post?.name}</b> :{' '}
                    {items.map((a, i) => (
                      <span key={a.id}>
                        {canEdit ? (
                          <select value={a.profile_id || ''} onChange={e => updateAssignment('planning_assignments', a.id, e.target.value)}
                            style={{ fontSize:12, border:'1px solid #E2E8F0', borderRadius:6, padding:'2px 6px', marginRight:6 }}>
                            <option value="">— libre —</option>
                            {eligiblePeople.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        ) : (
                          <span>{personName(a)}{i < items.length-1 ? ', ' : ''}</span>
                        )}
                      </span>
                    ))}
                  </div>
                ))}
                {monday && (
                  <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid #F1F5F9', fontSize:13 }}>
                    <div style={{ fontWeight:700, marginBottom:6 }}>Lundi {formatDateShort(monday.date)} — Prière 19h</div>
                    {(monday.prayer||[]).map(p => (
                      <div key={p.id} style={{ marginBottom:4 }}>
                        🙇🏽‍♀️ {canEdit ? (
                          <select value={p.profile_id || ''} onChange={e => updateAssignment('planning_prayer_assignments', p.id, e.target.value)}
                            style={{ fontSize:12, border:'1px solid #E2E8F0', borderRadius:6, padding:'2px 6px' }}>
                            <option value="">— libre —</option>
                            {eligiblePeople.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                          </select>
                        ) : personName(p)} ({p.duration_minutes}min)
                      </div>
                    ))}
                    <div style={{ marginTop:6 }}>
                      📞 Phoning : {(monday.phoning||[]).map(ph => (
                        canEdit ? (
                          <select key={ph.id} value={ph.profile_id || ''} onChange={e => updateAssignment('planning_phoning_assignments', ph.id, e.target.value)}
                            style={{ fontSize:12, border:'1px solid #E2E8F0', borderRadius:6, padding:'2px 6px' }}>
                            <option value="">— libre —</option>
                            {eligiblePeople.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                          </select>
                        ) : <span key={ph.id}>{personName(ph)}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <div className="card" style={{ padding:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>Texte WhatsApp (modifiable)</div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={copyText} style={btnSecondary}>
                  {copySuccess ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />} {copySuccess ? 'Copié !' : 'Copier'}
                </button>
                <button onClick={downloadImage} style={btnSecondary}>
                  <Download size={14} strokeWidth={2} /> Image PNG
                </button>
              </div>
            </div>
            <textarea value={editableText} onChange={e => setEditableText(e.target.value)}
              style={{ width:'100%', minHeight:400, fontFamily:'monospace', fontSize:12, padding:12, borderRadius:8, border:'1px solid #E2E8F0', boxSizing:'border-box' }} />
          </div>
        </div>
      )}

      {showUnavail && (
        <div style={overlayStyle} onClick={e => e.target===e.currentTarget && setShowUnavail(false)}>
          <div style={modalStyle}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontWeight:700, fontSize:16 }}>Indisponibilités — {MONTH_NAMES_FR[Number(month.slice(5,7))-1]} {month.slice(0,4)}</div>
              <button onClick={() => setShowUnavail(false)} style={{ border:'none', background:'#F1F5F9', borderRadius:8, width:28, height:28, cursor:'pointer' }}><X size={14} /></button>
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              <select value={unavailPick} onChange={e => setUnavailPick(e.target.value)} style={{ flex:1, padding:8, borderRadius:8, border:'1px solid #E2E8F0' }}>
                <option value="">— Choisir une personne —</option>
                {eligiblePeople.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input value={unavailReason} onChange={e => setUnavailReason(e.target.value)} placeholder="Raison (optionnel)"
                style={{ flex:1, padding:8, borderRadius:8, border:'1px solid #E2E8F0' }} />
              <button onClick={addUnavailability} style={btnPrimary}>Ajouter</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {unavailList.map(u => (
                <div key={u.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#F8FAFC', padding:'8px 12px', borderRadius:8 }}>
                  <span style={{ fontSize:13 }}>{u.profile?.name} {u.reason ? `— ${u.reason}` : ''}</span>
                  <button onClick={() => removeUnavailability(u.id)} style={{ border:'none', background:'none', cursor:'pointer', color:'#DC2626' }}><X size={14} /></button>
                </div>
              ))}
              {unavailList.length === 0 && <div style={{ fontSize:12, color:'#94A3B8' }}>Personne d'indisponible pour ce mois.</div>}
            </div>
          </div>
        </div>
      )}

      {showAddPost && (
        <div style={overlayStyle} onClick={e => e.target===e.currentTarget && setShowAddPost(false)}>
          <div style={modalStyle}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontWeight:700, fontSize:16 }}>Ajouter un poste</div>
              <button onClick={() => setShowAddPost(false)} style={{ border:'none', background:'#F1F5F9', borderRadius:8, width:28, height:28, cursor:'pointer' }}><X size={14} /></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <input value={newPost.name} onChange={e => setNewPost({...newPost, name:e.target.value})} placeholder="Nom du poste"
                style={{ padding:8, borderRadius:8, border:'1px solid #E2E8F0' }} />
              <input value={newPost.emoji} onChange={e => setNewPost({...newPost, emoji:e.target.value})} placeholder="Emoji (optionnel)"
                style={{ padding:8, borderRadius:8, border:'1px solid #E2E8F0' }} />
              <input type="number" min={1} value={newPost.default_slots} onChange={e => setNewPost({...newPost, default_slots:Number(e.target.value)})}
                placeholder="Nombre de personnes" style={{ padding:8, borderRadius:8, border:'1px solid #E2E8F0' }} />
              <button onClick={addPostType} style={btnPrimary}>Ajouter le poste</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const btnPrimary = { display:'flex', alignItems:'center', gap:6, background:'#0B3D91', color:'#fff', border:'none', borderRadius:8, padding:'8px 14px', fontSize:13, fontWeight:700, cursor:'pointer' }
const btnSecondary = { display:'flex', alignItems:'center', gap:6, background:'#F1F5F9', color:'#334155', border:'none', borderRadius:8, padding:'8px 14px', fontSize:13, fontWeight:600, cursor:'pointer' }
const overlayStyle = { position:'fixed', inset:0, background:'rgba(15,23,42,.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }
const modalStyle = { background:'#fff', borderRadius:16, padding:24, width:'100%', maxWidth:480, maxHeight:'85vh', overflowY:'auto' }
