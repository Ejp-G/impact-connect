'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { STAGE_LABEL, NEED_CATEGORIES, NEED_IS_SENSITIVE } from '@/lib/constants'
import {
  NEED_ICON_MAP, Sparkles, Heart, Phone, MessageCircle, Calendar, Mail,
  MessageSquare, MapPin, Home, FileText, Tag, Clock, HelpCircle, Save, AlertTriangle
} from '@/lib/icons'

const METHODS = [
  ['telephone', 'Téléphone'], ['whatsapp', 'WhatsApp'], ['sms', 'SMS'],
  ['visite', 'Visite'], ['rencontre_culte', 'Rencontre après le culte']
]
const RESULTS = [
  ['repondu', 'A répondu'], ['messagerie', 'Messagerie'],
  ['pas_de_reponse', 'Pas de réponse'], ['numero_invalide', 'Numéro invalide']
]

const COMPLETENESS_FIELDS = [
  { id: 'date_of_birth', label: 'Date de naissance', Icon: Calendar, type: 'date' },
  { id: 'email',         label: 'E-mail',            Icon: Mail,     type: 'email' },
  { id: 'whatsapp',      label: 'WhatsApp',          Icon: MessageSquare, type: 'text' },
  { id: 'address',       label: 'Adresse',           Icon: MapPin,   type: 'text' },
  { id: 'commune',       label: 'Commune',           Icon: Home,     type: 'text' },
  { id: 'quartier',      label: 'Quartier',          Icon: MapPin,   type: 'text' },
  { id: 'situation',     label: 'Situation / notes', Icon: FileText, type: 'textarea' },
  { id: 'interests',     label: "Centres d'intérêt", Icon: Tag,      type: 'array' },
  { id: 'availability',  label: 'Disponibilités',    Icon: Clock,    type: 'array' },
  { id: 'how_found',     label: 'Comment il/elle a connu l\u2019église', Icon: HelpCircle, type: 'text' },
  { id: 'prayer_request',label: 'Sujet de prière',   Icon: Heart,    type: 'textarea' },
]

function isEmptyValue(v) {
  if (v === null || v === undefined) return true
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'string') return v.trim() === ''
  return false
}

// ============================================================
// Formatage du numéro pour un lien wa.me valide.
// wa.me exige un format international pur : indicatif pays +
// numéro local SANS le 0 initial, sans espaces/tirets/parenthèses.
// Les visiteurs sont en Guadeloupe (590) ou Martinique (596) ; on
// détecte l'indicatif déjà présent, sinon on applique 590 par défaut.
// ============================================================
function formatWhatsappNumber(rawPhone) {
  if (!rawPhone) return null
  const digitsOnly = String(rawPhone).replace(/\D/g, '')
  if (!digitsOnly) return null

  // Déjà au format international (ex: 590690390557 ou 596696123456)
  if (digitsOnly.startsWith('590') || digitsOnly.startsWith('596')) {
    return digitsOnly
  }

  // Format local avec 0 initial (ex: 0690390557) -> on retire le 0
  // et on préfixe par l'indicatif Guadeloupe (590) par défaut.
  const withoutLeadingZero = digitsOnly.startsWith('0') ? digitsOnly.slice(1) : digitsOnly
  return `590${withoutLeadingZero}`
}

function MissingInfoPanel({ contact, missingFields, isAssignedIntegrator, onSaved, onDirtyChange }) {
  const supabase = useMemo(() => createClient(), [])
  const [values, setValues] = useState(() => {
    const initial = {}
    missingFields.forEach(f => { initial[f.id] = '' })
    return initial
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const hasAnyInput = Object.values(values).some(v => String(v).trim() !== '')

  // Signale a la fenetre parente si cette section a des saisies non
  // enregistrees, pour la confirmation de fermeture globale.
  useEffect(() => { onDirtyChange?.(hasAnyInput) }, [hasAnyInput])

  async function handleSave() {
    setSaving(true)
    setError(null)
    const payload = {}
    missingFields.forEach(f => {
      const raw = values[f.id]
      if (raw === undefined || String(raw).trim() === '') return
      if (f.type === 'array') {
        payload[f.id] = raw.split(',').map(s => s.trim()).filter(Boolean)
      } else {
        payload[f.id] = raw
      }
    })
    if (Object.keys(payload).length === 0) {
      setSaving(false)
      return
    }
    const { error: updateError } = await supabase.from('contacts').update(payload).eq('id', contact.id)
    if (updateError) {
      setError(updateError.message)
      setSaving(false)
    } else {
      onDirtyChange?.(false)
      onSaved()
    }
  }

  if (missingFields.length === 0) return null

  return (
    <div style={{ background: '#FFFBF5', border: '1px solid #FED7AA', borderRadius: 12, padding: 16, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <AlertTriangle size={16} strokeWidth={2} color="#C2410C" />
        <div style={{ fontSize: 13, fontWeight: 800, color: '#9A3412' }}>Informations à compléter</div>
      </div>
      <div style={{ fontSize: 12, color: '#9A3412', marginBottom: 14 }}>
        {isAssignedIntegrator
          ? "C'est vous qui suivez ce visiteur — complétez sa fiche pendant cet échange."
          : 'Il manque encore certaines informations pour ce visiteur.'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {missingFields.map(f => (
          <div key={f.id}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              <f.Icon size={13} strokeWidth={2} color="#94A3B8" /> {f.label}
            </label>
            {f.type === 'textarea' ? (
              <textarea
                rows={2}
                value={values[f.id]}
                onChange={e => setValues(v => ({ ...v, [f.id]: e.target.value }))}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            ) : (
              <input
                type={f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text'}
                value={values[f.id]}
                onChange={e => setValues(v => ({ ...v, [f.id]: e.target.value }))}
                placeholder={f.type === 'array' ? 'séparés par des virgules' : ''}
                style={inputStyle}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#DC2626', background: '#FEF2F2', borderRadius: 8, padding: '8px 10px', marginTop: 10 }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!hasAnyInput || saving}
        style={{
          marginTop: 14, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8,
          border: 'none', fontSize: 13, fontWeight: 700, color: '#fff',
          background: hasAnyInput && !saving ? '#EA580C' : '#FDBA74',
          cursor: hasAnyInput && !saving ? 'pointer' : 'not-allowed'
        }}
      >
        <Save size={14} strokeWidth={2} /> {saving ? 'Enregistrement…' : 'Enregistrer les informations'}
      </button>
    </div>
  )
}

// Petite confirmation de fermeture, affichee au-dessus de la fenetre
// principale si une saisie non enregistree existe (compte-rendu ou
// panneau de complétude).
function UnsavedChangesConfirm({ onContinue, onDiscard }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 22, maxWidth: 380, width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,.3)' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#1E293B', marginBottom: 8 }}>
          Modifications non enregistrées
        </div>
        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginBottom: 18 }}>
          Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer cette fenêtre ?
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onContinue} className="btn btn-secondary">Continuer la saisie</button>
          <button onClick={onDiscard} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700, background: '#DC2626', color: '#fff', cursor: 'pointer' }}>
            Fermer sans enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NewcomerReportPanel({ contactId, onClose, onOpenFullProfile, currentProfile }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [contact, setContact] = useState(null)
  const [integratorPair, setIntegratorPair] = useState([])
  const [reports, setReports] = useState([])
  const [needsHistory, setNeedsHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [missingInfoDirty, setMissingInfoDirty] = useState(false)

  const [form, setForm] = useState({
    method: 'telephone', result: 'repondu', duration_minutes: '',
    notes: '', next_action: '', next_contact_date: ''
  })
  const [checkedNeeds, setCheckedNeeds] = useState({})

  useEffect(() => { if (contactId) load() }, [contactId])

  async function load() {
    setLoading(true)
    const { data: c } = await supabase.from('contacts')
      .select(`
        id,first_name,last_name,sex,phone,whatsapp,commune,quartier,address,stage,
        date_of_birth,email,situation,interests,availability,how_found,prayer_request,
        fi:familles_impact(name),welcomed_by:profiles!contacts_welcomed_by_fkey(name)
      `)
      .eq('id', contactId).single()
    setContact(c)

    const { data: pairData } = await supabase.from('contact_integrators')
      .select('position, integrator:profiles(id,name)')
      .eq('contact_id', contactId).order('position')
    setIntegratorPair(pairData || [])

    const { data: reportRows } = await supabase.from('integrator_reports')
      .select('id,contacted_at,method,result,duration_minutes,notes,next_action,next_contact_date,integrator:profiles(name)')
      .eq('contact_id', contactId)
      .order('contacted_at', { ascending: false })
    setReports(reportRows || [])

    const { data: needRows } = await supabase.from('contact_needs')
      .select('id,category,domain,note,status,detected_at,detected_by:profiles(name)')
      .eq('contact_id', contactId)
      .order('detected_at', { ascending: false })
    setNeedsHistory(needRows || [])

    setLoading(false)
  }

  function toggleNeed(categoryId) {
    setCheckedNeeds(prev => {
      const next = { ...prev }
      if (categoryId in next) delete next[categoryId]
      else next[categoryId] = ''
      return next
    })
  }

  function setNeedNote(categoryId, text) {
    setCheckedNeeds(prev => ({ ...prev, [categoryId]: text }))
  }

  async function submitReport() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setSaving(true)

    const { error } = await supabase.from('integrator_reports').insert({
      contact_id: contactId,
      integrator_id: session.user.id,
      method: form.method,
      result: form.result,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      notes: form.notes.trim() || null,
      next_action: form.next_action.trim() || null,
      next_contact_date: form.next_contact_date || null
    })

    if (!error) {
      await supabase.from('contacts').update({ integrator_contacted: true }).eq('id', contactId)

      if (contact?.stage === 'visiteur') {
        fetch(`/api/contacts/${contactId}/stage`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newStage: 'contacte' })
        }).catch(console.error)
      }

      const needEntries = Object.entries(checkedNeeds)
      if (needEntries.length) {
        const rows = needEntries.map(([categoryId, note]) => {
          const cat = NEED_CATEGORIES.find(n => n.id === categoryId)
          return {
            contact_id: contactId,
            category: categoryId,
            domain: cat?.domain || 'personnel',
            sensitive: NEED_IS_SENSITIVE(categoryId),
            note: note?.trim() || null,
            detected_by: session.user.id
          }
        })
        await supabase.from('contact_needs').insert(rows)
      }
    }

    setSaving(false)
    if (error) { alert(error.message); return }

    setForm({ method: 'telephone', result: 'repondu', duration_minutes: '', notes: '', next_action: '', next_contact_date: '' })
    setCheckedNeeds({})
    await load()
    router.refresh()
  }

  if (!contactId) return null

  const spiritualNeeds = NEED_CATEGORIES.filter(n => n.domain === 'spirituel')
  const personalNeeds = NEED_CATEGORIES.filter(n => n.domain === 'personnel')

  const missingFields = contact ? COMPLETENESS_FIELDS.filter(f => isEmptyValue(contact[f.id])) : []
  const isAssignedIntegrator = integratorPair.some(p => p.integrator?.id === currentProfile?.id)

  const primaryPhone = contact?.phone || contact?.whatsapp
  const whatsappNumber = formatWhatsappNumber(contact?.whatsapp || contact?.phone)

  // Saisie en cours = compte-rendu commence OU panneau de complétude
  // rempli. Determine si on doit confirmer avant de fermer.
  const reportDirty = form.notes.trim() !== '' || form.next_action.trim() !== ''
    || form.next_contact_date !== '' || form.duration_minutes !== ''
    || Object.keys(checkedNeeds).length > 0
  const hasUnsavedChanges = reportDirty || missingInfoDirty

  function requestClose() {
    if (hasUnsavedChanges) {
      setShowCloseConfirm(true)
    } else {
      onClose()
    }
  }

  return (
    // Plus de fermeture au clic sur l'arriere-plan : seule la croix,
    // le bouton Annuler (via requestClose) ou une action de
    // validation peuvent fermer cette fenetre.
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: 720 }}>
        {loading || !contact ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Chargement…</div>
        ) : (
          <>
            <div style={modalHeaderStyle}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{contact.first_name} {contact.last_name}</div>
                <div style={{ fontSize: 12, opacity: .85 }}>
                  {contact.commune || '—'} · {STAGE_LABEL(contact.stage)}
                </div>
              </div>
              <button onClick={requestClose} style={closeBtnStyle}>✕</button>
            </div>

            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {primaryPhone ? (
                <>
                  <a href={`tel:${primaryPhone}`} style={{
                    display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
                    background: '#EFF6FF', color: '#1D4ED8', padding: '9px 16px', borderRadius: 10,
                    fontWeight: 800, fontSize: 16, letterSpacing: .3
                  }}>
                    <Phone size={16} strokeWidth={2.2} /> {primaryPhone}
                  </a>
                  {whatsappNumber && (
                    <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" style={{
                      display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none',
                      background: '#F0FDF4', color: '#166534', padding: '9px 14px', borderRadius: 10,
                      fontWeight: 700, fontSize: 13
                    }}>
                      <MessageCircle size={15} strokeWidth={2.2} /> WhatsApp
                    </a>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>Aucun numéro renseigné</div>
              )}
            </div>

            <div style={{ padding: 20 }}>

              <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 18, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <InfoLine label="Intégrateurs" value={integratorPair.map(p => p.integrator?.name).filter(Boolean).join(' & ') || '—'} />
                <InfoLine label="FIJ" value={contact.fi?.name || 'Non attribuée'} />
                <InfoLine label="Accueilli par" value={contact.welcomed_by?.name || '—'} />
                {onOpenFullProfile && (
                  <button onClick={() => onOpenFullProfile(contactId)} style={{ ...smallBtnStyle, marginLeft: 'auto' }}>
                    Voir la fiche complète
                  </button>
                )}
              </div>

              <MissingInfoPanel
                contact={contact}
                missingFields={missingFields}
                isAssignedIntegrator={isAssignedIntegrator}
                onSaved={() => { load(); router.refresh() }}
                onDirtyChange={setMissingInfoDirty}
              />

              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Nouveau compte-rendu</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                    {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <select value={form.result} onChange={e => setForm({ ...form, result: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                    {RESULTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <input type="number" min={0} placeholder="Durée (min)" value={form.duration_minutes}
                    onChange={e => setForm({ ...form, duration_minutes: e.target.value })} style={{ ...inputStyle, width: 110 }} />
                </div>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Compte rendu (ex: allait bien, travaille de nuit, viendra dimanche...)"
                  style={{ ...inputStyle, minHeight: 60 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={form.next_action} onChange={e => setForm({ ...form, next_action: e.target.value })}
                    placeholder="Prochaine action prévue" style={{ ...inputStyle, flex: 1 }} />
                  <input type="date" value={form.next_contact_date}
                    onChange={e => setForm({ ...form, next_contact_date: e.target.value })} style={{ ...inputStyle, width: 160 }} />
                </div>

                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                    Besoins constatés lors de cet échange (optionnel)
                  </div>

                  <NeedGroup title="Vie spirituelle" TitleIcon={Sparkles} items={spiritualNeeds} checked={checkedNeeds} onToggle={toggleNeed} onNote={setNeedNote} />
                  <NeedGroup title="Vie personnelle" TitleIcon={Heart} items={personalNeeds} checked={checkedNeeds} onToggle={toggleNeed} onNote={setNeedNote} />
                </div>

                <button onClick={submitReport} disabled={saving} style={{ ...primaryBtnStyle, marginTop: 8 }}>
                  {saving ? 'Enregistrement…' : 'Enregistrer le compte-rendu'}
                </button>
              </div>

              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Historique des échanges</div>
              {reports.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 20 }}>Aucun compte-rendu pour le moment.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                  {reports.map(r => (
                    <div key={r.id} style={{ fontSize: 12, background: '#F8FAFC', borderRadius: 8, padding: '8px 12px' }}>
                      <b>{r.integrator?.name || '—'}</b> · {METHODS.find(m => m[0] === r.method)?.[1] || r.method} · {RESULTS.find(m => m[0] === r.result)?.[1] || r.result}
                      {r.duration_minutes ? ` · ${r.duration_minutes} min` : ''}
                      <span style={{ color: '#94A3B8' }}> · {new Date(r.contacted_at).toLocaleString('fr-FR')}</span>
                      {r.notes && <div style={{ color: '#475569', marginTop: 4 }}>{r.notes}</div>}
                      {r.next_action && <div style={{ color: '#0B3D91', marginTop: 2, fontWeight: 600 }}>→ {r.next_action}{r.next_contact_date ? ` (${r.next_contact_date})` : ''}</div>}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Besoins détectés</div>
              {needsHistory.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94A3B8' }}>Aucun besoin détecté pour le moment.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {needsHistory.map(n => {
                    const cat = NEED_CATEGORIES.find(c => c.id === n.category)
                    const Icon = NEED_ICON_MAP[n.category]
                    return (
                      <div key={n.id} style={{ fontSize: 12, background: '#F8FAFC', borderRadius: 8, padding: '8px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {Icon && <Icon size={13} strokeWidth={2} />} <b>{cat?.label || n.category}</b>
                        </span>
                        <span style={{ color: '#94A3B8' }}> · signalé par {n.detected_by?.name || '—'} le {new Date(n.detected_at).toLocaleDateString('fr-FR')}</span>
                        {n.note && <div style={{ color: '#475569', marginTop: 4 }}>{n.note}</div>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showCloseConfirm && (
        <UnsavedChangesConfirm
          onContinue={() => setShowCloseConfirm(false)}
          onDiscard={onClose}
        />
      )}
    </div>
  )
}

function NeedGroup({ title, TitleIcon, items, checked, onToggle, onNote }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
        {TitleIcon && <TitleIcon size={13} strokeWidth={2} />} {title}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map(item => {
          const isChecked = item.id in checked
          const ItemIcon = NEED_ICON_MAP[item.id]
          return (
            <div key={item.id} style={{ width: isChecked ? '100%' : 'auto' }}>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
                padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                background: isChecked ? (item.sensitive ? '#FEF2F2' : '#EFF6FF') : '#F8FAFC',
                border: `1px solid ${isChecked ? (item.sensitive ? '#FCA5A5' : '#93C5FD') : '#E2E8F0'}`
              }}>
                <input type="checkbox" checked={isChecked} onChange={() => onToggle(item.id)} style={{ width: 14, height: 14 }} />
                {ItemIcon && <ItemIcon size={13} strokeWidth={2} />} {item.label}
              </label>
              {isChecked && (
                <input
                  value={checked[item.id]}
                  onChange={e => onNote(item.id, e.target.value)}
                  placeholder="Note (optionnel)"
                  style={{ ...inputStyle, marginTop: 4, fontSize: 12 }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function InfoLine({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{value}</div>
    </div>
  )
}

// Descendu de ~40px par rapport au haut de l'ecran (au lieu d'un
// centrage vertical strict) pour que l'en-tete (nom complet du
// visiteur) reste toujours visible sans defilement sur mobile, quelle
// que soit la taille de l'ecran.
const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000,
  padding: '40px 16px 24px', overflowY: 'auto'
}
const modalStyle = {
  background: '#fff', borderRadius: 16, width: '100%', maxWidth: 720,
  maxHeight: 'calc(100vh - 64px)', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)'
}
const modalHeaderStyle = {
  padding: '18px 20px', background: 'linear-gradient(135deg,var(--nd) 0%,var(--n) 100%)',
  color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  borderTopLeftRadius: 16, borderTopRightRadius: 16, position: 'sticky', top: 0, zIndex: 1
}
const closeBtnStyle = {
  background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 28, height: 28,
  borderRadius: 8, cursor: 'pointer', fontSize: 14
}
const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0',
  fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box'
}
const primaryBtnStyle = {
  background: 'var(--n)', color: '#fff', border: 'none', padding: '10px 18px',
  borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer'
}
const smallBtnStyle = {
  background: '#fff', color: '#334155', border: '1px solid #E2E8F0', padding: '6px 12px',
  borderRadius: 6, fontWeight: 600, fontSize: 11, cursor: 'pointer'
}
