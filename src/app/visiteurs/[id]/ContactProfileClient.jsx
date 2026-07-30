'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { STAGE_LABEL, STAGE_COLOR, NEED_CATEGORIES } from '@/lib/constants'
import { scoreColor } from '@/lib/utils'
import ContactDetailModal from '@/components/contacts/ContactDetailModal'
import {
  ArrowLeft, Pencil, Phone, Mail, MapPin, Calendar, Users, Home,
  MessageCircle, Compass, CheckCircle2, XCircle, Clock, NEED_ICON_MAP
} from '@/lib/icons'

const TIMELINE_STYLE = {
  audit:         { Icon: Clock,         color: '#94A3B8' },
  report:        { Icon: Phone,         color: '#3B82F6' },
  communication: { Icon: MessageCircle, color: '#8B5CF6' },
  need:          { Icon: Compass,       color: '#F97316' },
  attendance:    { Icon: CheckCircle2,  color: '#22C55E' },
}

const NEED_STATUS_LABEL = { a_traiter: 'À traiter', en_cours: 'En cours', termine: 'Terminé' }
const NEED_STATUS_COLOR = { a_traiter: '#EF4444', en_cours: '#F97316', termine: '#22C55E' }

const ini = (fn, ln) => ((fn || '')[0] || '') + ((ln || '')[0] || '')

function formatDateTime(d) {
  return new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

export default function ContactProfileClient({ contact, integratorPair, timeline, needs, communications, reports, profile }) {
  const router = useRouter()
  const [tab, setTab] = useState('apercu')
  const [showEdit, setShowEdit] = useState(false)

  const isAdmin = profile?.role === 'admin'
  const canEdit = isAdmin || profile?.role === 'responsable_suivi' || profile?.role === 'responsable_integration'

  const age = contact.date_of_birth
    ? Math.floor((Date.now() - new Date(contact.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null

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
            {contact.is_minor && <span className="badge" style={{ background: '#FEF3C7', color: '#92400E' }}>Mineur</span>}
            {contact.contact_preference === 'none' && (
              <span className="badge" style={{ background: '#FEF2F2', color: '#DC2626', fontWeight: 700 }}>Ne pas contacter</span>
            )}
            {contact.integrator_contacted && (
              <span className="badge" style={{ background: '#DCFCE7', color: '#166534', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={11} strokeWidth={2} /> Contact confirmé
              </span>
            )}
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

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Colonne info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 12 }}>Informations</div>
            <InfoRow Icon={Phone} value={contact.phone || '—'} />
            <InfoRow Icon={Mail} value={contact.email || '—'} />
            <InfoRow Icon={MapPin} value={contact.commune || '—'} />
            <InfoRow Icon={Calendar} value={age !== null ? `${age} ans` : '—'} />
            <InfoRow Icon={Calendar} value={contact.first_visit_date ? `Arrivé(e) le ${contact.first_visit_date}` : '—'} />
            {contact.welcomed_by?.name && <InfoRow Icon={Users} value={`Accueilli par ${contact.welcomed_by.name}`} />}
          </div>

          <div className="card">
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 12 }}>Intégrateurs</div>
            {integratorPair.length === 0 ? (
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

      {showEdit && (
        <ContactDetailModal
          contactId={contact.id}
          onClose={() => { setShowEdit(false); router.refresh() }}
          communes={[]}
          fis={[]}
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
