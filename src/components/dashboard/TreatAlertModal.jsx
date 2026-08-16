'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getTaskState, TASK_STATE_LABEL } from '@/lib/suivi-priority'
import { X, CheckCircle2, AlertCircle } from '@/lib/icons'

// Motifs de traitement (section 12 du cahier des charges). "Autre"
// ouvre un champ de précision libre.
const MOTIFS = [
  'Suivi effectué',
  'Personne jointe',
  'Personne non joignable',
  'Numéro incorrect',
  'Personne ne souhaite plus être contactée',
  'Rendez-vous effectué',
  'Rendez-vous reporté',
  'Nouveau rendez-vous programmé',
  'Situation réglée',
  'Tâche devenue inutile',
  'Doublon',
  'Autre',
]

export default function TreatAlertModal({ taskId, onClose }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [alreadyTreated, setAlreadyTreated] = useState(false)
  const [success, setSuccess] = useState(null)

  const [motif, setMotif] = useState('Suivi effectué')
  const [motifDetail, setMotifDetail] = useState('')
  const [compteRendu, setCompteRendu] = useState('')
  const [scheduleNext, setScheduleNext] = useState(false)
  const [nextDate, setNextDate] = useState('')

  useEffect(() => { if (taskId) load() }, [taskId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('tasks')
      .select('*, contact:contacts(id,first_name,last_name,phone,commune)')
      .eq('id', taskId).single()
    setTask(data)
    setAlreadyTreated(data?.status === 'done')
    setLoading(false)
  }

  const canSubmit = compteRendu.trim().length > 0 && !saving && !alreadyTreated
    && (!scheduleNext || !!nextDate)

  async function submit() {
    if (!canSubmit || !task) return
    setSaving(true)

    // Garde-fou anti-doublon (section 17) : re-vérifier juste avant
    // d'agir que personne d'autre n'a traité cette tâche entre-temps.
    // Évite un double traitement si deux personnes ouvrent la même
    // alerte au même moment.
    const { data: fresh } = await supabase.from('tasks').select('status').eq('id', taskId).single()
    if (!fresh || fresh.status !== 'pending') {
      setSaving(false)
      setAlreadyTreated(true)
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    const now = new Date().toISOString()
    const finalMotif = motif === 'Autre' && motifDetail.trim() ? `Autre : ${motifDetail.trim()}` : motif

    // 1) Clôture de la tâche — jamais de suppression, l'historique reste
    // dans audit_log et dans integrator_reports.
    const { error: taskError } = await supabase.from('tasks')
      .update({ status: 'done', done_at: now, done_by: session?.user?.id })
      .eq('id', taskId)
    if (taskError) { setSaving(false); alert(taskError.message); return }

    await supabase.from('audit_log').insert({
      action: `Alerte traitée depuis le dashboard — ${finalMotif}`,
      entity_type: 'task', entity_id: taskId,
      performed_by: session?.user?.id,
      details: { motif: finalMotif, compte_rendu: compteRendu.trim() },
    })

    // 2) Compte-rendu dans integrator_reports — même table que
    // NewcomerReportPanel.jsx : apparaît donc automatiquement dans la
    // timeline de la fiche visiteur et dans "Ma journée", sans créer un
    // deuxième système de suivi parallèle.
    if (task.contact?.id && session?.user?.id) {
      await supabase.from('integrator_reports').insert({
        contact_id: task.contact.id,
        integrator_id: session.user.id,
        method: 'telephone',
        result: 'repondu',
        notes: `[Traité depuis le dashboard] Motif : ${finalMotif}. ${compteRendu.trim()}`,
        next_action: scheduleNext ? 'Relance programmée' : null,
        next_contact_date: scheduleNext ? nextDate : null,
        contacted_at: now,
      })
      await supabase.from('contacts').update({ integrator_contacted: true }).eq('id', task.contact.id)
    }

    // 3) Nouvelle action si un prochain contact est programmé (section
    // 13) — l'ancienne tâche reste clôturée (jamais réécrite), une
    // nouvelle tâche distincte est créée avec la date choisie.
    if (scheduleNext && nextDate) {
      await supabase.from('tasks').insert({
        contact_id: task.contact_id,
        assigned_to: task.assigned_to,
        type: task.type,
        title: task.title || task.type,
        priority: 'normal',
        due_date: nextDate,
        auto_created: false,
      })
    }

    setSaving(false)
    setSuccess(scheduleNext && nextDate
      ? `✓ Suivi enregistré — Nouvelle relance programmée pour le ${new Date(nextDate).toLocaleDateString('fr-FR')}.`
      : "✓ Suivi enregistré — L'alerte a été traitée avec succès.")

    router.refresh()
    setTimeout(() => { onClose() }, 1800)
  }

  if (!taskId) return null

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {loading || !task ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Chargement…</div>
        ) : (
          <>
            <div style={headerStyle}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Traiter l'alerte</div>
              <button onClick={onClose} style={closeBtnStyle}><X size={16} strokeWidth={2.5} /></button>
            </div>

            <div style={{ padding: 20 }}>
              {alreadyTreated ? (
                <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: 14, fontSize: 13, color: '#9A3412', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={16} strokeWidth={2} color="#C2410C" />
                  Cette alerte a déjà été traitée par quelqu'un d'autre entre-temps.
                </div>
              ) : success ? (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: 14, fontSize: 13, color: '#166534', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                  <CheckCircle2 size={16} strokeWidth={2} /> {success}
                </div>
              ) : (
                <>
                  <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 14, marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <InfoRow label="Nom du visiteur" value={`${task.contact?.first_name || ''} ${task.contact?.last_name || ''}`.trim() || '—'} />
                    <InfoRow label="Type d'action" value={task.title || task.type} />
                    <InfoRow label="Échéance" value={task.due_date || '—'} />
                    <InfoRow label="État actuel" value={`${TASK_STATE_LABEL[getTaskState(task)].emoji} ${TASK_STATE_LABEL[getTaskState(task)].label}`} />
                  </div>

                  <Field label="Motif du traitement *">
                    <select value={motif} onChange={e => setMotif(e.target.value)} style={inputStyle}>
                      {MOTIFS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </Field>
                  {motif === 'Autre' && (
                    <Field label="Précision">
                      <input value={motifDetail} onChange={e => setMotifDetail(e.target.value)} placeholder="Préciser le motif…" style={inputStyle} />
                    </Field>
                  )}

                  <Field label="Compte-rendu *">
                    <textarea value={compteRendu} onChange={e => setCompteRendu(e.target.value)}
                      placeholder="Ex : appelée à 14h, elle va bien, souhaite qu'on la relance la semaine prochaine…"
                      style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
                  </Field>

                  <Field label="Prochain contact">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                        <input type="radio" checked={!scheduleNext} onChange={() => setScheduleNext(false)} /> Aucun prochain contact
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                        <input type="radio" checked={scheduleNext} onChange={() => setScheduleNext(true)} /> Programmer un prochain contact
                      </label>
                      {scheduleNext && (
                        <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} style={{ ...inputStyle, width: 180 }} />
                      )}
                    </div>
                  </Field>

                  <button onClick={submit} disabled={!canSubmit} style={{
                    ...primaryBtnStyle, width: '100%', marginTop: 14,
                    opacity: canSubmit ? 1 : .5, cursor: canSubmit ? 'pointer' : 'not-allowed'
                  }}>
                    {saving ? 'Enregistrement…' : 'Valider le traitement'}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}
function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: '#94A3B8' }}>{label}</span>
      <span style={{ fontWeight: 700, color: '#1E293B' }}>{value}</span>
    </div>
  )
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }
const modalStyle = { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }
const headerStyle = { padding: '18px 20px', background: 'linear-gradient(135deg,var(--nd) 0%,var(--n) 100%)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: 16, borderTopRightRadius: 16, position: 'sticky', top: 0, zIndex: 1 }
const closeBtnStyle = { background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 8, cursor: 'pointer' }
const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
const primaryBtnStyle = { background: 'var(--n)', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }
