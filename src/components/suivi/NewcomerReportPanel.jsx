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
        const
