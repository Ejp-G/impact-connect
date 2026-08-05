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
  AlertTriangle, MessageSquare, FileText, Tag, HelpCircle, Heart, Save
} from '@/lib/icons'

const TIMELINE_STAGES = ['visiteur', 'contacte', 'invite_fi', 'fi1', 'fi2', 'integre', 'parcours']

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

// ============================================================
// Panneau de complétude : détecte les champs vides parmi une
// liste fixe, affiche une barre de progression + formulaire de
// complétion rapide. Écrit directement dans `contacts` (RLS +
// trigger d'historique gèrent la traçabilité automatiquement).
// ============================================================
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
          <b>{expectedName}</b> ainsi que <b>toutes ses données
