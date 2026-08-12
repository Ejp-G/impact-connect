'use client'
import { useState, useMemo, useEffect } from 'react'
import { buildPriorityQueue, getDailyMission, REASON_LABEL } from '@/lib/suivi-priority'
import { formatWhatsappNumber } from '@/lib/phone'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export default function MissionTab({ contacts, tasks, needs, reports, profile, onOpenReport, onOpenProfile }) {
  const [started, setStarted] = useState(false)
  const [skippedIds, setSkippedIds] = useState([])
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [openCategory, setOpenCategory] = useState(null)

  // La file complète, elle, se recalcule bien en temps réel — c'est
  // volontaire pour "Mon suivi" (catégories) et pour repérer qui est
  // encore actionnable.
  const queue = useMemo(() => buildPriorityQueue(contacts, tasks, needs, reports), [contacts, tasks, needs, reports])

  // -----------------------------------------------------------------
  // FIGER la liste des 5 personnes du jour (correctif du bug de
  // progression). Sans ça, dès qu'une personne est contactée, elle sort
  // du top 5 et une nouvelle la remplace — la liste entière change et
  // "fait / total" retombe à 0 avec un groupe différent. On choisit donc
  // la liste UNE SEULE FOIS par jour, on la garde en localStorage (clé
  // par profil + date), et on ne fait plus que suivre l'état de CES
  // personnes précises au fil de la journée.
  // -----------------------------------------------------------------
  const storageKey = profile?.id ? `mission_ids:${profile.id}:${todayKey()}` : null
  const [frozenIds, setFrozenIds] = useState(null)

  useEffect(() => {
    if (!storageKey || queue.length === 0) return
    let stored = null
    try {
      const raw = window.localStorage.getItem(storageKey)
      stored = raw ? JSON.parse(raw) : null
    } catch { stored = null }

    if (stored && Array.isArray(stored) && stored.length > 0) {
      setFrozenIds(stored)
    } else {
      const actionable = queue.filter(i => i.needsAction)
      const size = Math.max(1, Math.min(5, actionable.length || 1))
      const initial = getDailyMission(queue, size).map(i => i.contact.id)
      setFrozenIds(initial)
      try { window.localStorage.setItem(storageKey, JSON.stringify(initial)) } catch {}
    }
    // On ne veut initialiser qu'une fois par jour/profil — pas à chaque
    // changement de queue, sinon on retombe dans le même problème.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, queue.length > 0])

  // missionItems = les personnes figées, avec leur état LE PLUS RÉCENT
  // (needsAction/handledToday) lu dans la queue fraîche à chaque rendu.
  const missionItems = useMemo(() => {
    if (!frozenIds) return []
    return frozenIds
      .map(id => queue.find(q => q.contact.id === id))
      .filter(Boolean)
  }, [frozenIds, queue])

  const missionIds = missionItems.map(i => i.contact.id)
  const doneCount = missionItems.filter(i => !i.needsAction).length
  const missionComplete = missionIds.length > 0 && doneCount >= missionIds.length

  const currentItem = missionItems.find(i => i.needsAction && !skippedIds.includes(i.contact.id))

  const firstName = profile?.name?.split(' ')[0] || ''

  const grouped = useMemo(() => {
    const by = { prioritaire: [], normal: [], a_relancer: [], accompagnement: [], a_reprendre: [] }
    queue.forEach(item => {
      if (item.reason === 'never_contacted') by.prioritaire.push(item)
      else by[item.reason]?.push(item)
    })
    return by
  }, [queue])

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>👋 Bonjour {firstName}</div>
      <div style={{ fontSize: 13, color: 'var(--gy)', marginBottom: 20 }}>
        Voici ce qu'il y a à faire aujourd'hui — pas de pression, juste la prochaine étape.
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 20, background: 'linear-gradient(135deg,var(--nd) 0%,var(--n) 100%)', color: '#fff' }}>
        <div style={{ fontSize: 13, fontWeight: 700, opacity: .9, marginBottom: 6 }}>🎯 Ta journée aujourd'hui</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
          {missionIds.length === 0 ? 'Aucune action urgente 🎉' : `${missionIds.length} personne${missionIds.length > 1 ? 's' : ''} à contacter`}
        </div>
        {missionIds.length > 0 && (
          <>
            <div style={{ fontSize: 12, opacity: .9, marginBottom: 6 }}>{doneCount} / {missionIds.length} effectuées</div>
            <div style={{ height: 8, background: 'rgba(255,255,255,.25)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(doneCount / missionIds.length) * 100}%`, background: '#fff', borderRadius: 999, transition: 'width .3s' }} />
            </div>
          </>
        )}
        {!started && missionIds.length > 0 && (
          <button onClick={() => setStarted(true)} style={{ marginTop: 16, background: '#fff', color: 'var(--n)', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            COMMENCER MES CONTACTS
          </button>
        )}
      </div>

      {started && missionIds.length > 0 && !missionComplete && currentItem && (
        <PersonCard
          item={currentItem}
          onSkip={() => setSkippedIds(prev => [...prev, currentItem.contact.id])}
          onOpenReport={onOpenReport}
          onOpenProfile={onOpenProfile}
        />
      )}

      {started && missionIds.length > 0 && (missionComplete || !currentItem) && (
        <div className="card" style={{ padding: 24, textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Journée terminée !</div>
          <div style={{ fontSize: 13, color: 'var(--gy)', marginBottom: 14 }}>Tu as effectué tes suivis prioritaires du jour.</div>
          <button onClick={() => setShowAllCategories(true)} style={{ background: '#F1F5F9', color: 'var(--gd)', border: 'none', padding: '9px 16px', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            Voir d'autres contacts
          </button>
        </div>
      )}

      {(showAllCategories || missionIds.length === 0) && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Mon suivi</div>
          <CategorySection title="🔥 Prioritaires" items={grouped.prioritaire} onOpenReport={onOpenReport} onOpenProfile={onOpenProfile} open={openCategory === 'prioritaire'} onToggle={() => setOpenCategory(c => c === 'prioritaire' ? null : 'prioritaire')} />
          <CategorySection title="❤️ À accompagner" items={grouped.accompagnement} onOpenReport={onOpenReport} onOpenProfile={onOpenProfile} open={openCategory === 'accompagnement'} onToggle={() => setOpenCategory(c => c === 'accompagnement' ? null : 'accompagnement')} />
          <CategorySection title="🟠 À relancer" items={grouped.a_relancer} onOpenReport={onOpenReport} onOpenProfile={onOpenProfile} open={openCategory === 'a_relancer'} onToggle={() => setOpenCategory(c => c === 'a_relancer' ? null : 'a_relancer')} />
          <CategorySection title="🟢 Normaux" items={grouped.normal} onOpenReport={onOpenReport} onOpenProfile={onOpenProfile} open={openCategory === 'normal'} onToggle={() => setOpenCategory(c => c === 'normal' ? null : 'normal')} />
          <CategorySection
            title="📚 À reprendre"
            items={grouped.a_reprendre}
            onOpenReport={onOpenReport}
            onOpenProfile={onOpenProfile}
            open={openCategory === 'a_reprendre'}
            onToggle={() => setOpenCategory(c => c === 'a_reprendre' ? null : 'a_reprendre')}
            note="Ces personnes n'ont pas été oubliées. Elles seront progressivement reprises."
          />
        </div>
      )}
    </div>
  )
}

function PersonCard({ item, onSkip, onOpenReport, onOpenProfile }) {
  const c = item.contact
  const reason = REASON_LABEL[item.reason]
  const whatsapp = formatWhatsappNumber(c.whatsapp || c.phone)
  return (
    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gy)', marginBottom: 6 }}>🎯 Ta prochaine personne</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{c.first_name} {c.last_name}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, background: '#F1F5F9', padding: '4px 10px', borderRadius: 999 }}>
          {reason.emoji} {reason.label}
        </span>
        {c.commune && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gy)', padding: '4px 10px' }}>📍 {c.commune}</span>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {c.phone && <a href={`tel:${c.phone}`} style={quickBtn('#EFF6FF', '#1D4ED8')}>📞 Appeler</a>}
        {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" style={quickBtn('#F0FDF4', '#166534')}>💬 WhatsApp</a>}
        {c.email && <a href={`mailto:${c.email}`} style={quickBtn('#FFFBEB', '#92400E')}>✉️ Email</a>}
        <button onClick={() => onOpenProfile(c.id)} style={{ ...quickBtn('#F8FAFC', '#334155'), border: '1px solid #E2E8F0', cursor: 'pointer' }}>👤 Voir la fiche</button>
        <button onClick={() => onOpenReport(c.id)} style={{ ...quickBtn('var(--n)', '#fff'), cursor: 'pointer', fontWeight: 800 }}>✅ Enregistrer le suivi</button>
      </div>

      <div style={{ marginTop: 14, textAlign: 'right' }}>
        <button onClick={onSkip} style={{ background: 'none', border: 'none', color: 'var(--gy)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
          Personne suivante →
        </button>
      </div>
    </div>
  )
}

function quickBtn(bg, color) {
  return { display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', background: bg, color, padding: '9px 14px', borderRadius: 10, fontWeight: 700, fontSize: 12 }
}

function CategorySection({ title, items, onOpenReport, onOpenProfile, open, onToggle, note }) {
  if (!items || items.length === 0) return null
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 10 }}>
      <div onClick={onToggle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', background: '#F8FAFC' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{open ? '▾' : '▸'} {title}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gy)', background: '#EFF6FF', padding: '2px 10px', borderRadius: 999 }}>{items.length}</span>
      </div>
      {open && (
        <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {note && <div style={{ fontSize: 12, color: 'var(--gy)', fontStyle: 'italic', marginBottom: 4 }}>{note}</div>}
          {items.map(item => {
            const c = item.contact
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#fff', borderRadius: 10, padding: '10px 12px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                <div onClick={() => onOpenProfile(c.id)} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  {c.first_name} {c.last_name}
                  {item.handledToday && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#16A34A' }}>✓ fait aujourd'hui</span>}
                </div>
                <button onClick={() => onOpenReport(c.id)} style={{ background: '#F1F5F9', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  ✅ Suivi
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
