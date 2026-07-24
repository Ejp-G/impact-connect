'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { STAGES } from '@/lib/constants'
import { scoreColor } from '@/lib/utils'
import ContactDetailModal from '@/components/contacts/ContactDetailModal'

const ini = (fn, ln) => ((fn || '')[0] || '') + ((ln || '')[0] || '')

export default function PipelineClient({ contacts, fis = [], communes = [] }) {
  const router = useRouter()
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverStage, setDragOverStage] = useState(null)
  const [selectedContactId, setSelectedContactId] = useState(null)
  const [warning, setWarning] = useState('')

  async function dropOn(stageId) {
    setDragOverStage(null)
    if (!draggingId) return
    const contact = contacts.find(c => c.id === draggingId)
    setDraggingId(null)
    if (!contact || contact.stage === stageId) return

    const res = await fetch(`/api/contacts/${draggingId}/stage`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStage: stageId })
    })
    const data = await res.json()
    if (data.error) { alert(data.error); return }
    if (data.warning) setWarning(`${contact.first_name} ${contact.last_name} : ${data.warning}`)
    router.refresh()
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--gy)', marginBottom: 16 }}>{contacts.length} personnes en parcours d'intégration</div>

      {warning && (
        <div style={{ background: '#FFF7ED', color: '#9A3412', padding: '10px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {warning} (déplacé quand même)</span>
          <button onClick={() => setWarning('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A3412', fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div className="kw">
        {STAGES.map(stage => {
          const sv = contacts.filter(c => c.stage === stage.id)
          const isOver = dragOverStage === stage.id
          return (
            <div
              key={stage.id}
              className="kc"
              onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id) }}
              onDragLeave={() => setDragOverStage(prev => (prev === stage.id ? null : prev))}
              onDrop={e => { e.preventDefault(); dropOn(stage.id) }}
              style={{ outline: isOver ? `2px dashed ${stage.color}` : 'none', outlineOffset: 2, borderRadius: 12 }}
            >
              <div className="kh" style={{ background: stage.color }}>
                <div style={{ fontSize: 18 }}>{stage.emoji}</div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: .5, textTransform: 'uppercase' }}>{stage.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{sv.length}</div>
              </div>
              {sv.length ? sv.map(c => (
                <div
                  key={c.id}
                  className="kcard"
                  draggable
                  onDragStart={() => setDraggingId(c.id)}
                  onDragEnd={() => setDraggingId(null)}
                  onClick={() => setSelectedContactId(c.id)}
                  style={{ borderLeft: `3px solid ${stage.color}`, cursor: 'grab', opacity: draggingId === c.id ? .4 : 1 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: c.sex === 'F' ? '#8B5CF6' : 'var(--n)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{ini(c.first_name, c.last_name)}</div>
                    <div><div style={{ fontSize: 11, fontWeight: 700 }}>{c.first_name} {c.last_name}</div><div style={{ fontSize: 10, color: 'var(--gy)' }}>{c.commune || '—'}</div></div>
                  </div>
                  <div className="sbr"><div className="sbr-bar"><div className="sbr-fill" style={{ width: `${c.integration_score}%`, background: scoreColor(c.integration_score) }} /></div><span className="sbr-val" style={{ color: scoreColor(c.integration_score) }}>{c.integration_score}</span></div>
                  {c.alert_level === 'red' && <div style={{ marginTop: 6, fontSize: 10, color: 'var(--re)', fontWeight: 600 }}>🔴 Urgence</div>}
                  {c.agent?.name && <div style={{ marginTop: 4, fontSize: 10, color: 'var(--gd)' }}>👤 {c.agent.name}</div>}
                </div>
              )) : <div style={{ padding: 16, borderRadius: 10, border: '2px dashed var(--br)', textAlign: 'center', color: '#CBD5E1', fontSize: 12 }}>Aucune personne</div>}
            </div>
          )
        })}
      </div>

      {selectedContactId && (
        <ContactDetailModal
          contactId={selectedContactId}
          onClose={() => { setSelectedContactId(null); router.refresh() }}
          communes={communes}
          fis={fis}
        />
      )}
    </div>
  )
}
