'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { STAGES, STAGE_LABEL, STAGE_COLOR } from '@/lib/constants'
import { Users, CheckCircle2, X } from '@/lib/icons'

const AUTHORIZED_VALUES = ['autorise', 'authorized', 'approved', 'valide']
const REFUSED_VALUES = ['refuse', 'refused', 'rejected']
const PENDING_VALUES = ['pending', 'en_attente']

function parentalStatusInfo(status, authDate) {
  const s = (status || '').toLowerCase()
  if (AUTHORIZED_VALUES.includes(s)) {
    return {
      label: `Autorisation parentale obtenue${authDate ? ` le ${new Date(authDate).toLocaleDateString('fr-FR')}` : ''}`,
      color: '#16A34A', bg: '#F0FDF4'
    }
  }
  if (REFUSED_VALUES.includes(s)) {
    return { label: 'Autorisation parentale refusée', color: '#DC2626', bg: '#FEF2F2' }
  }
  if (PENDING_VALUES.includes(s)) {
    return { label: "En attente d'autorisation parentale", color: '#B45309', bg: '#FFFBEB' }
  }
  return { label: 'Aucune autorisation parentale enregistrée', color: '#B45309', bg: '#FFFBEB' }
}

export default function ContactDetailModal({ contactId, onClose, communes = [], fis = [] }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [contact, setContact] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(null)
  const [currentProfile, setCurrentProfile] = useState(null)

  const [confirmingContact, setConfirmingContact] = useState(false)
  const [contactChannel, setContactChannel] = useState('appel')
  const [contactNote, setContactNote] = useState('')

  const [changingStage, setChangingStage] = useState(false)
  const [newStage, setNewStage] = useState('')
  const [stageWarning, setStageWarning] = useState('')

  const [history, setHistory] = useState([])

  const [communesList, setCommunesList] = useState(communes)
  const [fisList, setFisList] = useState(fis)

  const [integratorPair, setIntegratorPair] = useState([])
  const [eligibleIntegrators, setEligibleIntegrators] = useState([])
  const [editingIntegrators, setEditingIntegrators] = useState(false)
  const [integrator1Id, setIntegrator1Id] = useState('')
  const [integrator2Id, setIntegrator2Id] = useState('')
  const [savingIntegrators, setSavingIntegrators] = useState(false)
  const [savingParental, setSavingParental] = useState(false)

  // Fermeture par la touche Echap, ou l'utilisateur peut cliquer sur la
  // croix, le bouton Annuler, ou l'arriere-plan sombre.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function setParentalStatus(status) {
    setSavingParental(true)
    const { error } = await supabase.from('contacts').update({
      parental_status: status,
      parental_auth_date: status === 'authorized' ? new Date().toISOString() : null
    }).eq('id', contactId)
    setSavingParental(false)
    if (error) { alert(error.message); return }
    await load()
    router.refresh()
  }

  useEffect(() => {
    if (contactId) load()
  }, [contactId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('contacts')
      .select('*, fi:familles_impact(id,name), agent:profiles!contacts_assigned_to_fkey(id,name)')
      .eq('id', contactId).single()
    setContact(data)
    setForm(data ? {
      first_name: data.first_name || '', last_name: data.last_name || '',
      sex: data.sex || '',
      date_of_birth: data.date_of_birth || '',
      parent_first_name: data.parent_first_name || '', parent_last_name: data.parent_last_name || '',
      parent_relation: data.parent_relation || '', parent_phone: data.parent_phone || '',
      parent_email: data.parent_email || '', parent_address: data.parent_address || '',
      phone: data.phone || '', whatsapp: data.whatsapp || '', email: data.email || '',
      commune_id: data.commune_id || '', quartier: data.quartier || '',
      fi_id: data.fi_id || '', prayer_request: data.prayer_request || '',
      situation: data.situation || '', baptism_date: data.baptism_date || '',
      contact_preference: data.contact_preference || '',
      first_visit_date: data.first_visit_date || '',
      welcomed_by_name: data.welcomed_by_name || '',
      salvation_call: data.salvation_call || false
    } : null)
    setNewStage(data?.stage || '')
    setLoading(false)

    if (!communes.length) {
      const { data: cs } = await supabase.from('communes').select('id,name').order('name')
      setCommunesList(cs || [])
    }
    if (!fis.length) {
      const { data: fsRows } = await supabase.from('familles_impact').select('id,name').order('name')
      setFisList(fsRows || [])
    }

    const { data: auditRows } = await supabase.from('audit_log')
      .select('id,action,details,created_at,performed_by')
      .eq('entity_type', 'contact').eq('entity_id', contactId)
      .order('created_at', { ascending: false }).limit(15)
    const ids = [...new Set((auditRows || []).map(r => r.performed_by).filter(Boolean))]
    let names = {}
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id,name').in('id', ids)
      names = Object.fromEntries((profs || []).map(p => [p.id, p.name]))
    }
    setHistory((auditRows || []).map(r => ({ ...r, authorName: names[r.performed_by] || '—' })))

    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const { data: me } = await supabase.from('profiles').select('id,role').eq('id', session.user.id).single()
      setCurrentProfile(me)
    }

    const { data: pairData } = await supabase.from('contact_integrators')
      .select('position, integrator:profiles(id,name,email)')
      .eq('contact_id', contactId).order('position')
    setIntegratorPair(pairData || [])
    setIntegrator1Id(pairData?.find(p => p.position === 1)?.integrator?.id || '')
    setIntegrator2Id(pairData?.find(p => p.position === 2)?.integrator?.id || '')

    if (data?.sex) {
      const { data: allActive } = await supabase.from('profiles')
        .select('id,name,email,role,secondary_roles')
        .eq('sex', data.sex)
        .eq('active', true)
        .order('name')
      const eligible = (allActive || []).filter(p =>
        ['equipe_suivi', 'responsable_suivi'].includes(p.role) ||
        (p.secondary_roles || []).includes('equipe_suivi')
      )
      setEligibleIntegrators(eligible)
    } else {
      setEligibleIntegrators([])
    }
  }

  async function saveForm() {
    setSaving(true)
    const commune = communesList.find(c => c.id === form.commune_id)
    const { error } = await supabase.from('contacts').update({
      first_name: form.first_name, last_name: form.last_name,
      sex: form.sex || null,
      date_of_birth: form.date_of_birth || null,
      parent_first_name: form.parent_first_name.trim() || null,
      parent_last_name: form.parent_last_name.trim() || null,
      parent_relation: form.parent_relation.trim() || null,
      parent_phone: form.parent_phone.trim() || null,
      parent_email: form.parent_email.trim() || null,
      parent_address: form.parent_address.trim() || null,
      phone: form.phone, whatsapp: form.whatsapp, email: form.email,
      commune_id: form.commune_id || null, commune: commune?.name || contact.commune,
      quartier: form.quartier, fi_id: form.fi_id || null,
      prayer_request: form.prayer_request, situation: form.situation,
      baptism_date: form.baptism_date || null,
      contact_preference: form.contact_preference || null,
      first_visit_date: form.first_visit_date || null,
      welcomed_by_name: form.welcomed_by_name.trim() || null,
      salvation_call: form.salvation_call
    }).eq('id', contactId)
    setSaving(false)
    if (error) { alert(error.message); return }
    await load()
    router.refresh()
  }

  async function submitContactConfirmation() {
    const { data: { session } } = await supabase.auth.getSession()
    const now = new Date().toISOString()
    const { error } = await supabase.from('contacts').update({ last_contact_at: now }).eq('id', contactId)
    if (error) { alert(error.message); return }
    await supabase.from('communication_logs').insert({
      contact_id: contactId, channel: contactChannel, direction: 'outbound',
      content: contactNote || `Contact effectué (${contactChannel})`,
      sent_by: session?.user?.id, sent_at: now, status: 'sent'
    })
    setConfirmingContact(false)
    setContactNote('')
    await load()
  }

  async function submitStageChange() {
    if (!newStage || newStage === contact.stage) { setChangingStage(false); return }
    const res = await fetch(`/api/contacts/${contactId}/stage`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStage })
    })
    const data = await res.json()
    if (data.error) { alert(data.error); return }
    setStageWarning(data.warning || '')
    setChangingStage(false)
    await load()
    router.refresh()
  }

  function nextStageId(current) {
    const idx = STAGES.findIndex(s => s.id === current)
    return idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1].id : null
  }

  const isAdmin = currentProfile?.role === 'admin'
  const canManageIntegrators = isAdmin || currentProfile?.role === 'responsable_suivi'

  // Âge calculé en direct sur la date saisie dans le formulaire :
  // la section « Représentant légal » apparaît dès que la date correspond
  // à un mineur, sans attendre l'enregistrement ni le trigger update_is_minor.
  // Calcul en heure locale (pas via new Date('YYYY-MM-DD') qui décale d'un
  // jour en Guadeloupe, UTC-4).
  let formAge = null
  if (form?.date_of_birth) {
    const [by, bm, bd] = String(form.date_of_birth).slice(0, 10).split('-').map(Number)
    const birth = new Date(by, bm - 1, bd)
    const now = new Date()
    formAge = now.getFullYear() - birth.getFullYear()
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) formAge--
  }
  const formIsMinor = formAge !== null ? formAge < 18 : !!contact?.is_minor
  const parentalInfo = parentalStatusInfo(contact?.parental_status, contact?.parental_auth_date)
  const missingParentInfo = formIsMinor && form && (
    !(form.parent_first_name.trim() || form.parent_last_name.trim()) || !form.parent_phone.trim()
  )

  async function saveIntegrators() {
    setSavingIntegrators(true)
    const res = await fetch(`/api/contacts/${contactId}/integrators`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ integrator1Id: integrator1Id || null, integrator2Id: integrator2Id || null })
    })
    const data = await res.json()
    setSavingIntegrators(false)
    if (data.error) { alert(data.error); return }
    setEditingIntegrators(false)
    await load()
    router.refresh()
  }

  if (!contactId) return null

  return (
    // Overlay entierement autonome (styles en ligne) : il ne depend plus
    // des classes CSS .modal-overlay / .modal qui se comportaient
    // differemment sur la page de profil visiteur (fiche decalee sur les
    // cotes, boutons hors ecran). Ici la fenetre est toujours centree,
    // limitee a 92% de la hauteur de l'ecran, avec defilement interne.
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={modalStyle}>

        {/* En-tete : toujours visible (ne defile pas), croix de fermeture
            presente meme pendant le chargement. */}
        <div style={modalHeaderStyle}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {loading || !contact ? 'Fiche visiteur' : `${contact.first_name} ${contact.last_name}`}
            </div>
            <div style={{ fontSize: 12, opacity: .85 }}>
              {loading || !contact ? 'Chargement…' : `${contact.commune || '—'} ${contact.is_minor ? '· Mineur' : ''}`}
            </div>
          </div>
          <button onClick={onClose} title="Fermer" style={closeBtnStyle}><X size={16} strokeWidth={2.5} /></button>
        </div>

        {loading || !contact ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Chargement…</div>
        ) : (
          <>
            {/* Zone centrale : seule cette partie defile. */}
            <div style={{ padding: 20, overflowY: 'auto', flex: 1, minHeight: 0 }}>

              <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: changingStage ? 10 : 0, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase' }}>Étape actuelle</div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: STAGE_COLOR(contact.stage) }}>{STAGE_LABEL(contact.stage)}</span>
                    {contact.contact_preference === 'none' && (
                      <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', padding: '2px 10px', borderRadius: 999 }}>
                        Ne pas contacter
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {nextStageId(contact.stage) && (
                      <button onClick={() => { setNewStage(nextStageId(contact.stage)); submitStageChange() }} style={smallBtnStyle}>Étape suivante →</button>
                    )}
                    <button onClick={() => setChangingStage(v => !v)} style={smallBtnStyle}>Changer d'étape</button>
                  </div>
                </div>
                {changingStage && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <select value={newStage} onChange={e => setNewStage(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                      {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <button onClick={submitStageChange} style={primaryBtnStyle}>Valider</button>
                  </div>
                )}
                {stageWarning && (
                  <div style={{ marginTop: 10, fontSize: 12, background: '#FFF7ED', color: '#9A3412', padding: '8px 12px', borderRadius: 8 }}>
                    {stageWarning} (l'étape a quand même été changée)
                  </div>
                )}
                {contact.stage === 'integre' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 12 }}>
                    <input type="checkbox" onChange={() => { setNewStage('parcours'); submitStageChange() }} style={{ width: 16, height: 16 }} />
                    A commencé le Parcours de croissance
                  </label>
                )}
                {contact.stage === 'parcours' && (
                  <div style={{ marginTop: 12, fontSize: 12, color: '#16A34A', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={13} strokeWidth={2} /> Parcours de croissance commencé
                  </div>
                )}
              </div>

              <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={12} strokeWidth={2} /> Intégrateurs assignés
                    {contact.integrator_contacted && (
                      <span style={{ color: '#16A34A', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <CheckCircle2 size={12} strokeWidth={2} /> Contact confirmé
                      </span>
                    )}
                  </div>
                  {canManageIntegrators && (
                    <button onClick={() => setEditingIntegrators(v => !v)} style={smallBtnStyle}>Modifier</button>
                  )}
                </div>

                {!contact.sex && (
                  <div style={{ fontSize: 12, background: '#FFF7ED', color: '#9A3412', padding: '8px 12px', borderRadius: 8, marginBottom: integratorPair.length || editingIntegrators ? 10 : 0 }}>
                    Le sexe de {contact.first_name} n'est pas renseigné. Renseignez-le dans le formulaire ci-dessous
                    (champ « Sexe ») puis enregistrez : la liste des intégrateurs du même sexe s'affichera alors ici.
                  </div>
                )}

                {!editingIntegrators ? (
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {integratorPair.length === 0 && contact.sex && <div style={{ fontSize: 13, color: '#94A3B8' }}>Aucun intégrateur assigné.</div>}
                    {integratorPair.map(p => (
                      <div key={p.position} style={{ fontSize: 13 }}>
                        <span style={{ color: '#94A3B8' }}>Intégrateur {p.position} :</span>{' '}
                        <b>{p.integrator?.name || '—'}</b>
                      </div>
                    ))}
                  </div>
                ) : !contact.sex ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditingIntegrators(false)} style={secondaryBtnStyle}>Fermer</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <select value={integrator1Id} onChange={e => setIntegrator1Id(e.target.value)} style={inputStyle}>
                      <option value="">— Intégrateur 1 —</option>
                      {eligibleIntegrators.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select value={integrator2Id} onChange={e => setIntegrator2Id(e.target.value)} style={inputStyle}>
                      <option value="">— Intégrateur 2 (optionnel) —</option>
                      {eligibleIntegrators.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>
                      Seuls les membres de l'équipe Suivi du même sexe que {contact.first_name} sont proposés.
                    </div>
                    {eligibleIntegrators.length === 0 && (
                      <div style={{ fontSize: 11, color: '#9A3412' }}>
                        Aucun membre de l'équipe Suivi de ce sexe n'est actif pour le moment.
                        Vérifiez que le sexe est renseigné sur les profils des membres de l'équipe (module Utilisateurs).
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditingIntegrators(false)} style={secondaryBtnStyle}>Annuler</button>
                      <button onClick={saveIntegrators} disabled={savingIntegrators} style={primaryBtnStyle}>
                        {savingIntegrators ? 'Enregistrement…' : 'Enregistrer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  Dernier contact : <b>{contact.last_contact_at ? new Date(contact.last_contact_at).toLocaleString('fr-FR') : 'jamais'}</b>
                </div>
                <button onClick={() => setConfirmingContact(v => !v)} style={smallBtnStyle}>Confirmer un contact</button>
              </div>
              {confirmingContact && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18, background: '#F8FAFC', borderRadius: 10, padding: 12 }}>
                  <select value={contactChannel} onChange={e => setContactChannel(e.target.value)} style={inputStyle}>
                    <option value="appel">Appel</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                  <input value={contactNote} onChange={e => setContactNote(e.target.value)} placeholder="Note (optionnel)" style={inputStyle} />
                  <button onClick={submitContactConfirmation} style={primaryBtnStyle}>Enregistrer le contact</button>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Field label="Prénom" style={{ flex: 1, minWidth: 0 }}><input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} style={inputStyle} /></Field>
                  <Field label="Nom" style={{ flex: 1, minWidth: 0 }}><input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} style={inputStyle} /></Field>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Field label="Sexe" style={{ flex: 1, minWidth: 0 }}>
                    <select value={form.sex} onChange={e => setForm({ ...form, sex: e.target.value })} style={{ ...inputStyle, borderColor: form.sex ? '#E2E8F0' : '#FDBA74' }}>
                      <option value="">— Non renseigné —</option>
                      <option value="M">Homme</option>
                      <option value="F">Femme</option>
                    </select>
                    {!form.sex && (
                      <div style={{ fontSize: 11, color: '#9A3412', marginTop: 4 }}>
                        Requis pour l'attribution d'intégrateurs (binôme du même sexe).
                      </div>
                    )}
                  </Field>
                  <Field label="Date de naissance" style={{ flex: 1, minWidth: 0 }}>
                    <input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} style={inputStyle} />
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                      Sert au calcul de l'âge et du statut « Mineur ».
                    </div>
                  </Field>
                </div>

                {formIsMinor && (
                  <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#9A3412', textTransform: 'uppercase', letterSpacing: .5 }}>
                      Représentant légal {formAge !== null ? `(mineur — ${formAge} ans)` : '(mineur)'}
                    </div>

                    <div style={{ fontSize: 12, fontWeight: 700, color: parentalInfo.color, background: parentalInfo.bg, borderRadius: 8, padding: '8px 10px' }}>
                      {parentalInfo.label}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setParentalStatus('authorized')}
                        disabled={savingParental}
                        style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#16A34A' }}
                      >
                        ✓ Autorisation obtenue
                      </button>
                      <button
                        onClick={() => setParentalStatus('pending')}
                        disabled={savingParental}
                        style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid #FDE68A', background: '#FFFBEB', color: '#B45309' }}
                      >
                        En attente
                      </button>
                      <button
                        onClick={() => setParentalStatus('refused')}
                        disabled={savingParental}
                        style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626' }}
                      >
                        ✗ Refusée
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: '#9A3412' }}>
                      {savingParental
                        ? 'Enregistrement du statut…'
                        : "Le statut est enregistré immédiatement. « Autorisation obtenue » horodate l'accord à la date du jour."}
                    </div>

                    {missingParentInfo && (
                      <div style={{ fontSize: 11, color: '#9A3412' }}>
                        Le nom et le téléphone du représentant légal sont requis pour un visiteur mineur.
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 10 }}>
                      <Field label="Prénom du représentant" style={{ flex: 1, minWidth: 0 }}>
                        <input value={form.parent_first_name} onChange={e => setForm({ ...form, parent_first_name: e.target.value })} style={{ ...inputStyle, background: '#fff' }} />
                      </Field>
                      <Field label="Nom du représentant" style={{ flex: 1, minWidth: 0 }}>
                        <input value={form.parent_last_name} onChange={e => setForm({ ...form, parent_last_name: e.target.value })} style={{ ...inputStyle, background: '#fff' }} />
                      </Field>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Field label="Lien de parenté" style={{ flex: 1, minWidth: 0 }}>
                        <input value={form.parent_relation} onChange={e => setForm({ ...form, parent_relation: e.target.value })} placeholder="Père, Mère, Tuteur…" style={{ ...inputStyle, background: '#fff' }} />
                      </Field>
                      <Field label="Téléphone du représentant" style={{ flex: 1, minWidth: 0 }}>
                        <input value={form.parent_phone} onChange={e => setForm({ ...form, parent_phone: e.target.value })} style={{ ...inputStyle, background: '#fff', borderColor: form.parent_phone.trim() ? '#E2E8F0' : '#FDBA74' }} />
                      </Field>
                    </div>
                    <Field label="Email du représentant">
                      <input value={form.parent_email} onChange={e => setForm({ ...form, parent_email: e.target.value })} style={{ ...inputStyle, background: '#fff' }} />
                    </Field>
                    <Field label="Adresse du représentant">
                      <input value={form.parent_address} onChange={e => setForm({ ...form, parent_address: e.target.value })} style={{ ...inputStyle, background: '#fff' }} />
                    </Field>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <Field label="Téléphone" style={{ flex: 1, minWidth: 0 }}><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inputStyle} /></Field>
                  <Field label="WhatsApp" style={{ flex: 1, minWidth: 0 }}><input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} style={inputStyle} /></Field>
                </div>
                <Field label="Email"><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} /></Field>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Field label="Commune" style={{ flex: 1, minWidth: 0 }}>
                    <select value={form.commune_id} onChange={e => setForm({ ...form, commune_id: e.target.value })} style={inputStyle}>
                      <option value="">—</option>
                      {communesList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Quartier" style={{ flex: 1, minWidth: 0 }}><input value={form.quartier} onChange={e => setForm({ ...form, quartier: e.target.value })} style={inputStyle} /></Field>
                </div>
                <Field label="Date de première visite">
                  <input type="date" value={form.first_visit_date} onChange={e => setForm({ ...form, first_visit_date: e.target.value })} style={inputStyle} />
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                    Référence officielle utilisée dans le Dashboard, la croissance annuelle, les rapports et le Pipeline.
                  </div>
                </Field>
                <Field label="Connecteur (personne qui a accueilli)">
                  <input value={form.welcomed_by_name} onChange={e => setForm({ ...form, welcomed_by_name: e.target.value })} style={inputStyle} placeholder="Prénom Nom" />
                </Field>
                <Field label="Type de visite">
                  <select value={form.salvation_call ? 'salut' : 'nouveau'} onChange={e => setForm({ ...form, salvation_call: e.target.value === 'salut' })} style={inputStyle}>
                    <option value="nouveau">Nouveau visiteur</option>
                    <option value="salut">Appel au salut</option>
                  </select>
                </Field>
                <Field label="FIJ attribuée">
                  <select value={form.fi_id} onChange={e => setForm({ ...form, fi_id: e.target.value })} style={inputStyle}>
                    <option value="">— Aucune —</option>
                    {fisList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </Field>
                <Field label="Préférence de contact">
                  <select value={form.contact_preference} onChange={e => setForm({ ...form, contact_preference: e.target.value })} style={inputStyle}>
                    <option value="">— Non renseignée —</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="telephone">Téléphone</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                    <option value="none">Ne pas être contacté(e)</option>
                  </select>
                  {form.contact_preference === 'none' && (
                    <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>
                      Aucune tâche, relance ni notification automatique ne sera générée tant que cette préférence reste "Ne pas être contacté(e)".
                    </div>
                  )}
                </Field>
                <Field label="Demande de prière"><textarea value={form.prayer_request} onChange={e => setForm({ ...form, prayer_request: e.target.value })} style={{ ...inputStyle, minHeight: 50 }} /></Field>
                <Field label="Situation / notes"><textarea value={form.situation} onChange={e => setForm({ ...form, situation: e.target.value })} style={{ ...inputStyle, minHeight: 50 }} /></Field>
                <Field label="Date de baptême"><input type="date" value={form.baptism_date} onChange={e => setForm({ ...form, baptism_date: e.target.value })} style={inputStyle} /></Field>
              </div>

              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Historique</div>
              {history.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94A3B8' }}>Aucune action enregistrée.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {history.map(h => (
                    <div key={h.id} style={{ fontSize: 11, color: '#64748B' }}>
                      <b>{h.authorName}</b> — {h.action}
                      {h.details?.from && h.details?.to && ` (${STAGE_LABEL(h.details.from)} → ${STAGE_LABEL(h.details.to)})`}
                      <span style={{ color: '#CBD5E1' }}> · {new Date(h.created_at).toLocaleString('fr-FR')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pied de fenetre fixe : toujours visible quel que soit le
                defilement. « Annuler » ferme sans enregistrer,
                « Enregistrer » sauvegarde le formulaire. */}
            <div style={modalFooterStyle}>
              <button onClick={onClose} style={{ ...secondaryBtnStyle, flex: 'none', padding: '10px 20px' }}>
                Annuler
              </button>
              <button onClick={saveForm} disabled={saving} style={{ ...primaryBtnStyle, flex: 'none', padding: '10px 20px' }}>
                {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, .55)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  boxSizing: 'border-box'
}
const modalStyle = {
  background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680,
  maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
  boxShadow: '0 20px 50px rgba(0,0,0,.25)', boxSizing: 'border-box'
}
const modalHeaderStyle = {
  padding: '16px 20px', background: 'linear-gradient(135deg,var(--nd) 0%,var(--n) 100%)',
  color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  gap: 12, flexShrink: 0
}
const modalFooterStyle = {
  padding: '12px 20px', borderTop: '1px solid #E2E8F0', background: '#FAFBFC',
  display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0
}
const closeBtnStyle = {
  background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', width: 32, height: 32,
  borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'center', flexShrink: 0
}
const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0',
  fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box'
}
const primaryBtnStyle = {
  background: 'var(--n)', color: '#fff', border: 'none', padding: '10px 18px',
  borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', flex: 1
}
const secondaryBtnStyle = {
  background: '#fff', color: '#374151', border: '1px solid #E2E8F0', padding: '10px 18px',
  borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', flex: 1
}
const smallBtnStyle = {
  background: '#fff', color: '#334155', border: '1px solid #E2E8F0', padding: '6px 12px',
  borderRadius: 6, fontWeight: 600, fontSize: 11, cursor: 'pointer'
}
