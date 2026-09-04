'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { STAGE_LABEL, STAGE_COLOR, NEED_CATEGORIES } from '@/lib/constants'
import { scoreColor } from '@/lib/utils'
import ContactDetailModal from '@/components/contacts/ContactDetailModal'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, Pencil, Phone, Mail, MapPin, Calendar, Users, Home,
  MessageCircle, Compass, CheckCircle2, XCircle, Clock, NEED_ICON_MAP,
  AlertTriangle, MessageSquare, FileText, Tag, HelpCircle, Heart, Save,
  HeartHandshake, RefreshCw
} from '@/lib/icons'

const TIMELINE_STAGES = ['visiteur', 'contacte', 'invite_fi', 'fi1', 'fi2', 'integre', 'parcours']

// Raisons du statut "Ne plus contacter" — mêmes valeurs que
// NewcomerReportPanel.jsx (contacts.do_not_contact_reason).
const DNC_REASON_LABEL = {
  autre_eglise: 'Fréquente déjà une église',
  demande_explicite: 'A demandé à ne pas être recontacté(e)',
  situation_particuliere: 'Situation particulière',
  autre: 'Autre',
}

function ProgressTimeline({ stage }) {
  const currentIndex = TIMELINE_STAGES.indexOf(stage)
  return (
    <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto' }}>
      {TIMELINE_STAGES.map((s, i) => {
        const done = currentIndex > i
        const current = currentIndex === i
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: done ? '#F0FDF4' : current ? '#FFFBEB' : '#F8FAFC', fontSize: 11, fontWeight: 600, color: done ? '#16A34A' : current ? '#B45309' : '#94A3B8' }}>
              <span>{done ? '✔' : current ? '🟡' : '⚪'}</span> {STAGE_LABEL(s)}
            </div>
            {i < TIMELINE_STAGES.length - 1 && <span style={{ color: '#E2E8F0' }}>—</span>}
          </div>
        )
      })}
    </div>
  )
}

const TIMELINE_STYLE = {
  audit:         { Icon: Clock,         color: '#94A3B8' },
  report:        { Icon: Phone,         color: '#3B82F6' },
  communication: { Icon: MessageCircle, color: '#8B5CF6' },
  need:          { Icon: Compass,       color: '#F97316' },
  attendance:    { Icon: CheckCircle2,  color: '#22C55E' },
  fi_journal:    { Icon: FileText,      color: '#0369A1' },
}

const NEED_STATUS_LABEL = { a_traiter: 'À traiter', en_cours: 'En cours', termine: 'Terminé' }
const NEED_STATUS_COLOR = { a_traiter: '#EF4444', en_cours: '#F97316', termine: '#22C55E' }

const SEX_LABEL = { M: 'Homme', F: 'Femme' }

const ini = (fn, ln) => ((fn || '')[0] || '') + ((ln || '')[0] || '')

function formatDateTime(d) {
  return new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

function formatDateOnly(d) {
  if (!d) return null
  const [y, m, day] = String(d).slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

function computeAge(d) {
  if (!d) return null
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number)
  const birth = new Date(y, m - 1, day)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--
  return age
}

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

function CompletenessBadge({ missingCount, total }) {
  const complete = missingCount === 0
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999,
      fontSize: 12, fontWeight: 700,
      background: complete ? '#DCFCE7' : '#FFF7ED',
      color: complete ? '#166534' : '#9A3412'
    }}>
      {complete ? '🟢 Fiche complète' : `🟠 ${missingCount} information${missingCount > 1 ? 's' : ''} manquante${missingCount > 1 ? 's' : ''}`}
    </div>
  )
}

function MissingInfoPanel({ contact, missingFields, isAssignedIntegrator, onSaved }) {
  const supabase = useMemo(() => createClient(), [])
  const [values, setValues] = useState(() => {
    const initial = {}
    missingFields.forEach(f => { initial[f.id] = f.type === 'array' ? '' : '' })
    return initial
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const hasAnyInput = Object.values(values).some(v => String(v).trim() !== '')

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
      onSaved()
    }
  }

  return (
    <div className="card" style={{ marginBottom: 20, border: '1px solid #FED7AA', background: '#FFFBF5' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <AlertTriangle size={16} strokeWidth={2} color="#C2410C" />
        <div style={{ fontSize: 13, fontWeight: 800, color: '#9A3412' }}>Informations à compléter</div>
      </div>
      <div style={{ fontSize: 12, color: '#9A3412', marginBottom: 14 }}>
        {isAssignedIntegrator
          ? "C'est vous qui suivez ce visiteur — complétez sa fiche pendant votre prochain échange."
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
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
              />
            ) : (
              <input
                type={f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text'}
                value={values[f.id]}
                onChange={e => setValues(v => ({ ...v, [f.id]: e.target.value }))}
                placeholder={f.type === 'array' ? 'séparés par des virgules' : ''}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, boxSizing: 'border-box' }}
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
          marginTop: 14, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10,
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

function DeleteVisitorModal({ contact, onClose, onDeleted }) {
  const supabase = useMemo(() => createClient(), [])
  const [confirmName, setConfirmName] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const expectedName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
  const nameMatches = confirmName.trim().toLowerCase() === expectedName.toLowerCase()
  const reasonOk = reason.trim().length >= 5
  const canDelete = nameMatches && reasonOk && !loading

  async function handleDelete() {
    if (!canDelete) return
    setLoading(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('delete_visiteur', {
      p_contact_id: contact.id,
      p_reason: reason.trim(),
    })
    if (rpcError) {
      setError(rpcError.message)
      setLoading(false)
    } else {
      onDeleted()
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, .55)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,.25)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <XCircle size={18} strokeWidth={2} color="#DC2626" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#991B1B' }}>Suppression définitive</div>
        </div>

        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginBottom: 12 }}>
          Vous êtes sur le point de supprimer <b>définitivement</b> la fiche de{' '}
          <b>{expectedName}</b> ainsi que <b>toutes ses données liées</b> (tâches de suivi,
          communications, besoins, présences, assignations d'intégrateurs, historique).
        </div>
        <div style={{ fontSize: 12, background: '#FEF2F2', color: '#991B1B', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontWeight: 600 }}>
          Cette action est irréversible. Une trace (qui, quand, pourquoi) sera conservée
          dans le journal des suppressions.
        </div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
          Pour confirmer, tapez le nom complet : <span style={{ color: '#DC2626' }}>{expectedName}</span>
        </label>
        <input
          type="text"
          value={confirmName}
          onChange={e => setConfirmName(e.target.value)}
          placeholder={expectedName}
          autoComplete="off"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 13,
            border: `1.5px solid ${confirmName && !nameMatches ? '#FCA5A5' : '#E2E8F0'}`,
            outline: 'none', marginBottom: 14, boxSizing: 'border-box'
          }}
        />

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
          Motif de la suppression (obligatoire)
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Ex. : doublon de la fiche de…, demande RGPD de la personne, fiche de test…"
          rows={3}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 13,
            border: `1.5px solid ${reason && !reasonOk ? '#FCA5A5' : '#E2E8F0'}`,
            outline: 'none', resize: 'vertical', marginBottom: 8, boxSizing: 'border-box', fontFamily: 'inherit'
          }}
        />

        {error && (
          <div style={{ fontSize: 12, color: '#DC2626', background: '#FEF2F2', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onClose} className="btn btn-secondary" disabled={loading}>
            Annuler
          </button>
          <button
            onClick={handleDelete}
            disabled={!canDelete}
            style={{
              padding: '9px 16px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
              cursor: canDelete ? 'pointer' : 'not-allowed',
              background: canDelete ? '#DC2626' : '#FCA5A5',
              color: '#fff', transition: 'background .15s'
            }}
          >
            {loading ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ContactProfileClient({ contact, integratorPair, timeline, needs, communications, reports, profile, noFiCoverage = false }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [tab, setTab] = useState('apercu')
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const [togglingTerritoire, setTogglingTerritoire] = useState(false)
  // NOUVEAU : réactivation du suivi ("Ne plus contacter" → suivi normal)
  const [reactivating, setReactivating] = useState(false)

  async function toggleHorsTerritoire(value) {
    setTogglingTerritoire(true)
    const res = await fetch(`/api/contacts/${contact.id}/hors-territoire`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ horsTerritoire: value })
    })
    const data = await res.json()
    setTogglingTerritoire(false)
    if (data.error) { alert(data.error); return }
    router.refresh()
  }

  // NOUVEAU : remise à zéro complète des 4 champs "Ne plus contacter" —
  // même logique que dans NewcomerReportPanel.jsx, tracée dans
  // audit_log ("Suivi réactivé") pour garder l'historique du cycle.
  async function reactivateContact() {
    const { data: { session } } = await supabase.auth.getSession()
    setReactivating(true)
    const { error } = await supabase.from('contacts').update({
      contact_preference: null,
      do_not_contact_reason: null,
      do_not_contact_detail: null,
      do_not_contact_at: null,
    }).eq('id', contact.id)
    if (!error) {
      await supabase.from('audit_log').insert({
        action: 'Suivi réactivé',
        entity_type: 'contact',
        entity_id: contact.id,
        performed_by: session?.user?.id,
      })
    }
    setReactivating(false)
    if (error) { alert(error.message); return }
    router.refresh()
  }

  const secondaryRoles = profile?.secondary_roles || []
  const hasEquipeSuivi = profile?.role === 'equipe_suivi' || secondaryRoles.includes('equipe_suivi')
  const hasResponsableSuivi = profile?.role === 'responsable_suivi' || secondaryRoles.includes('responsable_suivi')
  const canEdit = ['admin', 'superviseur', 'integrateur'].includes(profile?.role) || hasEquipeSuivi || hasResponsableSuivi
  const isAdmin = ['admin', 'superviseur'].includes(profile?.role) || hasResponsableSuivi

  const isAssignedIntegrator = integratorPair.some(p => p.integrator?.id === profile?.id)

  const missingFields = COMPLETENESS_FIELDS.filter(f => isEmptyValue(contact[f.id]))
  const completenessPct = Math.round(((COMPLETENESS_FIELDS.length - missingFields.length) / COMPLETENESS_FIELDS.length) * 100)

  const age = computeAge(contact.date_of_birth)

  const parentalStatusNorm = (contact.parental_status || '').toLowerCase()
  const parentalAuthorized = ['autorise', 'authorized', 'approved', 'valide'].includes(parentalStatusNorm)
  const parentalPending = ['pending', 'en_attente'].includes(parentalStatusNorm)
  const parentalRefused = ['refuse', 'refused', 'rejected'].includes(parentalStatusNorm)
  const parentName = [contact.parent_first_name, contact.parent_last_name].filter(Boolean).join(' ')
  const missingParentInfo = !parentName || !contact.parent_phone

  const isDoNotContact = contact.contact_preference === 'none'

  const TABS = [
    ['apercu', 'Aperçu'],
    ['besoins', `Besoins (${needs.length})`],
    ['communications', `Communications (${communications.length})`],
    ['notes', 'Notes'],
  ]

  return (
    <div style={{ maxWidth: 1100 }}>
      <button onClick={() => router.push('/visiteurs')} style={backBtnStyle}>
        <ArrowLeft size={15} strokeWidth={2} /> Retour aux visiteurs
      </button>

      {/* En-tete */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: contact.sex === 'F' ? '#8B5CF6' : 'var(--n)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
          {ini(contact.first_name, contact.last_name)}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1E293B' }}>{contact.first_name} {contact.last_name}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: STAGE_COLOR(contact.stage) + '20', color: STAGE_COLOR(contact.stage) }}>{STAGE_LABEL(contact.stage)}</span>
            <span className="badge" style={{ background: contact.salvation_call ? '#FEF3C7' : '#EFF6FF', color: contact.salvation_call ? '#92400E' : '#3B82F6' }}>
              {contact.salvation_call ? 'Appel au salut' : 'Nouveau visiteur'}
            </span>
            {contact.is_minor && <span className="badge" style={{ background: '#FEF3C7', color: '#92400E' }}>Mineur</span>}
            {contact.is_minor && missingParentInfo && (
              <span className="badge" style={{ background: '#FFF7ED', color: '#9A3412', fontWeight: 700 }}>
                Représentant légal non renseigné
              </span>
            )}
            {contact.is_minor && !missingParentInfo && !parentalAuthorized && (
              <span className="badge" style={{ background: '#FFF7ED', color: '#9A3412', fontWeight: 700 }}>
                Autorisation parentale non confirmée
              </span>
            )}
            {contact.is_minor && parentalAuthorized && (
              <span className="badge" style={{ background: '#DCFCE7', color: '#166534', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={11} strokeWidth={2} /> Autorisation parentale
              </span>
            )}
            {!contact.sex && (
              <span className="badge" style={{ background: '#FFF7ED', color: '#9A3412', fontWeight: 700 }}>
                Sexe non renseigné — attribution d'intégrateur impossible
              </span>
            )}
            {isDoNotContact && (
              <span className="badge" style={{ background: '#F5F3FF', color: '#6D28D9', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <HeartHandshake size={11} strokeWidth={2} /> À porter dans la prière
              </span>
            )}
            {contact.integrator_contacted && (
              <span className="badge" style={{ background: '#DCFCE7', color: '#166534', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={11} strokeWidth={2} /> Contact confirmé
              </span>
            )}
            {contact.hors_territoire && (
              <span className="badge" style={{ background: '#FFF7ED', color: '#9A3412', fontWeight: 700 }}>
                📍 Hors territoire
              </span>
            )}
            {noFiCoverage && !contact.hors_territoire && (
              <span className="badge" style={{ background: '#FFF7ED', color: '#9A3412', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={11} strokeWidth={2} /> Pas encore de FIJ dans son secteur
              </span>
            )}
            <CompletenessBadge missingCount={missingFields.length} total={COMPLETENESS_FIELDS.length} />
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: .5 }}>Score</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(contact.integration_score) }}>{contact.integration_score ?? 0}</div>
        </div>
        {canEdit && (
          <button onClick={() => setShowEdit(true)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Pencil size={14} strokeWidth={2} /> Modifier
          </button>
        )}
      </div>

      {/* Barre de complétude */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Complétude de la fiche</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: completenessPct === 100 ? '#16A34A' : '#EA580C' }}>{completenessPct}%</div>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: '#F1F5F9', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${completenessPct}%`, borderRadius: 999, background: completenessPct === 100 ? '#22C55E' : '#F97316', transition: 'width .3s' }} />
        </div>
        {missingFields.length > 0 && (
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
            Il reste {missingFields.length} information{missingFields.length > 1 ? 's' : ''} à compléter.
          </div>
        )}
      </div>

      {/* NOUVEAU : bloc "Ne plus contacter" — raison + réactivation.
          Visible uniquement si le statut est actif, cohérent avec le
          même bloc dans NewcomerReportPanel.jsx (même source de
          vérité : contacts.contact_preference/do_not_contact_*). */}
      {isDoNotContact && (
        <div className="card" style={{ marginBottom: 20, border: '1px solid #DDD6FE', background: '#F5F3FF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <HeartHandshake size={16} strokeWidth={2} color="#6D28D9" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#6D28D9' }}>À porter dans la prière — ne pas contacter</span>
          </div>
          <div style={{ fontSize: 12, color: '#5B21B6', marginBottom: 10 }}>
            Raison : {DNC_REASON_LABEL[contact.do_not_contact_reason] || '—'}
            {contact.do_not_contact_reason === 'autre' && contact.do_not_contact_detail ? ` — ${contact.do_not_contact_detail}` : ''}
            {contact.do_not_contact_at ? ` · depuis le ${new Date(contact.do_not_contact_at).toLocaleDateString('fr-FR')}` : ''}
          </div>
          {canEdit && (
            <button onClick={reactivateContact} disabled={reactivating} style={{
              display: 'flex', alignItems: 'center', gap: 6, background: '#6D28D9', color: '#fff',
              border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer'
            }}>
              <RefreshCw size={13} strokeWidth={2} /> {reactivating ? 'Réactivation…' : 'Réactiver le suivi'}
            </button>
          )}
        </div>
      )}

      {/* Panneau de complétion rapide, visible uniquement pour ceux qui peuvent éditer */}
      {canEdit && missingFields.length > 0 && (
        <MissingInfoPanel
          contact={contact}
          missingFields={missingFields}
          isAssignedIntegrator={isAssignedIntegrator}
          onSaved={() => router.refresh()}
        />
      )}

      <ProgressTimeline stage={contact.stage} />

      <div className="g2r" style={{ alignItems: 'start' }}>

        {/* Colonne info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 12 }}>Informations</div>
            <InfoRow Icon={Users} value={SEX_LABEL[contact.sex] || 'Sexe non renseigné'} />
            <InfoRow Icon={Phone} value={contact.phone || '—'} />
            <InfoRow Icon={Mail} value={contact.email || '—'} />
            <InfoRow Icon={MapPin} value={contact.commune || '—'} />
            <InfoRow Icon={Calendar} value={contact.date_of_birth ? `Né(e) le ${formatDateOnly(contact.date_of_birth)}${age !== null ? ` (${age} ans)` : ''}` : 'Date de naissance non renseignée'} />
            <InfoRow Icon={Calendar} value={contact.first_visit_date ? `Arrivé(e) le ${formatDateOnly(contact.first_visit_date)}` : '—'} />
            {contact.welcomed_by_name && <InfoRow Icon={Users} value={`Connecteur : ${contact.welcomed_by_name}`} />}
            {contact.invited_by && <InfoRow Icon={Users} value={`Invité par : ${contact.invited_by}`} />}
          </div>

          {contact.is_minor && (
            <div className="card" style={{ border: missingParentInfo || !parentalAuthorized ? '1px solid #FED7AA' : undefined }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 12 }}>
                Représentant légal
              </div>
              {missingParentInfo ? (
                <div style={{ fontSize: 12, background: '#FFF7ED', color: '#9A3412', borderRadius: 8, padding: '8px 10px', marginBottom: parentName || contact.parent_phone ? 10 : 0 }}>
                  {!parentName && !contact.parent_phone
                    ? 'Aucun représentant légal renseigné. Utilisez le bouton « Modifier » pour le compléter.'
                    : 'Informations incomplètes : le nom et le téléphone du représentant sont requis.'}
                </div>
              ) : null}
              {parentName && (
                <InfoRow Icon={Users} value={`${parentName}${contact.parent_relation ? ` (${contact.parent_relation})` : ''}`} />
              )}
              {contact.parent_phone && <InfoRow Icon={Phone} value={contact.parent_phone} />}
              {contact.parent_email && <InfoRow Icon={Mail} value={contact.parent_email} />}
              {contact.parent_address && <InfoRow Icon={MapPin} value={contact.parent_address} />}
              <div style={{
                fontSize: 12, fontWeight: 700, borderRadius: 8, padding: '8px 10px', marginTop: 8,
                color: parentalAuthorized ? '#16A34A' : parentalRefused ? '#DC2626' : '#9A3412',
                background: parentalAuthorized ? '#F0FDF4' : parentalRefused ? '#FEF2F2' : '#FFF7ED'
              }}>
                {parentalAuthorized
                  ? `Autorisation parentale obtenue${contact.parental_auth_date ? ` le ${new Date(contact.parental_auth_date).toLocaleDateString('fr-FR')}` : ''}`
                  : parentalRefused
                    ? 'Autorisation parentale refusée'
                    : parentalPending
                      ? "En attente d'autorisation parentale"
                      : 'Aucune autorisation parentale enregistrée'}
              </div>
            </div>
          )}

          <div className="card">
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 12 }}>Intégrateurs</div>
            {!contact.sex ? (
              <div style={{ fontSize: 12, background: '#FFF7ED', color: '#9A3412', borderRadius: 8, padding: '8px 10px' }}>
                Renseignez d'abord le sexe (bouton « Modifier ») pour pouvoir attribuer un binôme d'intégrateurs du même sexe.
              </div>
            ) : integratorPair.length === 0 ? (
              <div style={{ fontSize: 13, color: '#94A3B8' }}>Aucun intégrateur assigné.</div>
            ) : (
              integratorPair.map(p => (
                <div key={p.position} style={{ fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: '#94A3B8' }}>Intégrateur {p.position} :</span> <b>{p.integrator?.name || '—'}</b>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Home size={13} strokeWidth={2} /> Famille d'Impact
            </div>
            {contact.fi ? (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{contact.fi.name}</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{contact.fi.day} à {contact.fi.time}</div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#94A3B8' }}>Non attribuée</div>
            )}
          </div>

          <div className="card" style={{ border: contact.hors_territoire ? '1px solid #FED7AA' : undefined }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 12 }}>Suivi territorial</div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: canEdit ? 'pointer' : 'default' }}>
              <input type="checkbox" checked={contact.hors_territoire} disabled={!canEdit || togglingTerritoire}
                onChange={e => toggleHorsTerritoire(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Hors territoire</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                  {contact.hors_territoire
                    ? "Sort du suivi territorial actif — reste dans la base."
                    : "Reste dans le suivi actif du territoire."}
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Colonne principale */}
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {TABS.map(([id, label]) => (
              <div key={id} onClick={() => setTab(id)} style={{
                padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: tab === id ? 'var(--n)' : '#F1F5F9', color: tab === id ? '#fff' : '#64748B'
              }}>
                {label}
              </div>
            ))}
          </div>

          {tab === 'apercu' && (
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Historique complet</div>
              {timeline.length === 0 ? (
                <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '20px 0' }}>Aucun événement enregistré.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {timeline.map((e, i) => {
                    const style = TIMELINE_STYLE[e.type] || TIMELINE_STYLE.audit
                    const Icon = e.type === 'attendance' && e.title.startsWith('Absent') ? XCircle : style.Icon
                    return (
                      <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 16, position: 'relative' }}>
                        {i < timeline.length - 1 && <div style={{ position: 'absolute', left: 15, top: 32, bottom: 0, width: 1, background: '#F1F5F9' }} />}
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: style.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                          <Icon size={15} strokeWidth={2} color={style.color} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{e.title}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                            {formatDateTime(e.date)}{e.sub ? ` · ${e.sub}` : ''}
                          </div>
                          {e.details && <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{typeof e.details === 'string' ? e.details : ''}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'besoins' && (
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Besoins détectés</div>
              {needs.length === 0 ? (
                <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '20px 0' }}>Aucun besoin détecté pour le moment.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {needs.map(n => {
                    const cat = NEED_CATEGORIES.find(c => c.id === n.category)
                    const Icon = NEED_ICON_MAP[n.category]
                    return (
                      <div key={n.id} style={{ background: '#F8FAFC', borderRadius: 10, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
                            {Icon && <Icon size={14} strokeWidth={2} />} {cat?.label || n.category}
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: NEED_STATUS_COLOR[n.status], background: NEED_STATUS_COLOR[n.status] + '15', padding: '2px 8px', borderRadius: 999 }}>
                            {NEED_STATUS_LABEL[n.status] || n.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                          signalé par {n.detected_by?.name || '—'} le {new Date(n.detected_at).toLocaleDateString('fr-FR')}
                        </div>
                        {n.note && <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>{n.note}</div>}
                        {n.action_note && <div style={{ fontSize: 12, color: '#0B3D91', marginTop: 4, fontWeight: 600 }}>→ {n.action_note}</div>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'communications' && (
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Communications</div>
              {communications.length === 0 ? (
                <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '20px 0' }}>Aucune communication enregistrée.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {communications.map(c => (
                    <div key={c.id} style={{ background: '#F8FAFC', borderRadius: 10, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{c.channel} · {c.direction === 'outbound' ? 'Envoyé' : 'Reçu'}</span>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>{formatDateTime(c.sent_at)}</span>
                      </div>
                      {c.content && <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>{c.content}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'notes' && (
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Demande de prière</div>
              <div style={{ fontSize: 13, color: contact.prayer_request ? '#334155' : '#94A3B8', background: '#F8FAFC', borderRadius: 10, padding: 12, marginBottom: 20 }}>
                {contact.prayer_request || 'Aucune.'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Situation / notes</div>
              <div style={{ fontSize: 13, color: contact.situation ? '#334155' : '#94A3B8', background: '#F8FAFC', borderRadius: 10, padding: 12 }}>
                {contact.situation || 'Aucune.'}
              </div>
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="card" style={{ marginTop: 24, border: '1px solid #FECACA' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>
            Zone dangereuse
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: '#64748B', maxWidth: 560, lineHeight: 1.5 }}>
              Supprimer définitivement cette fiche et toutes ses données liées.
              Action réservée aux superviseurs et responsables, tracée dans le
              journal des suppressions, et <b>irréversible</b>.
            </div>
            <button
              onClick={() => setShowDelete(true)}
              style={{
                padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                background: '#fff', color: '#DC2626', border: '1.5px solid #FCA5A5',
                cursor: 'pointer', flexShrink: 0
              }}
            >
              Supprimer ce visiteur
            </button>
          </div>
        </div>
      )}

      {showEdit && (
        <ContactDetailModal
          contactId={contact.id}
          onClose={() => { setShowEdit(false); router.refresh() }}
          communes={[]}
          fis={[]}
        />
      )}

      {showDelete && (
        <DeleteVisitorModal
          contact={contact}
          onClose={() => setShowDelete(false)}
          onDeleted={() => { setShowDelete(false); router.push('/visiteurs'); router.refresh() }}
        />
      )}
    </div>
  )
}

function InfoRow({ Icon, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13, color: '#475569' }}>
      <Icon size={13} strokeWidth={2} color="#94A3B8" style={{ flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

const backBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
  cursor: 'pointer', color: '#64748B', fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0
}
