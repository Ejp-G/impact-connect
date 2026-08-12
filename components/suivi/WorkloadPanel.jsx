'use client'
import { useMemo } from 'react'
import { buildWorkload } from '@/lib/suivi-priority'

export default function WorkloadPanel({ contacts, tasks, needs }) {
  const workload = useMemo(() => buildWorkload(contacts, tasks, needs), [contacts, tasks, needs])
  if (workload.length === 0) return null

  const avg = workload.reduce((s, w) => s + w.total, 0) / workload.length

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9', fontSize: 14, fontWeight: 700 }}>
        📊 Charge de suivi par intégrateur
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {workload.map(w => {
          const overloaded = w.total > avg * 1.6 && w.total > 10
          return (
            <div key={w.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F8FAFC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{w.name}</span>
                <span style={{ fontSize: 12, color: 'var(--gy)' }}>{w.total} personne{w.total > 1 ? 's' : ''} suivie{w.total > 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--gy)', flexWrap: 'wrap' }}>
                <span>🔥 {w.prioritaire} prioritaires</span>
                <span>🟠 {w.a_relancer} à relancer</span>
                <span>📚 {w.a_reprendre} à reprendre</span>
              </div>
              {overloaded && (
                <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: '#C2410C', background: '#FFFBEB', padding: '6px 10px', borderRadius: 8 }}>
                  ⚠️ Charge de suivi élevée — cet intégrateur possède beaucoup de personnes à reprendre. Un rééquilibrage manuel peut être envisagé.
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
