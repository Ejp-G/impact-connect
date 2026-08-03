'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { STAGE_LABEL, STAGE_COLOR, NEED_CATEGORIES } from '@/lib/constants'
import { scoreColor } from '@/lib/utils'
import ContactDetailModal from '@/components/contacts/ContactDetailModal'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, Pencil, Phone, Mail, MapPin, Calendar, Users, Home,
  MessageCircle, Compass, CheckCircle2, XCircle, Clock, NEED_ICON_MAP
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

/* ============================================================
   MODAL DE SUPPRESSION DÉFINITIVE (admin uniquement)
   - exige la saisie exacte du nom complet du visiteur
   - exige un motif (5 caractères minimum)
   - appelle la RPC sécurisée delete_visiteur (contrôle admin
     refait côté serveur, trace dans deletion_log)
   ============================================================ */
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
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 20px 50px rgba(0,0,0,.25)' }}>
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

export default function ContactProfileClient({ contact, integratorPair, timeline, needs, communications, reports, profile }) {
  const router = useRouter()
  const [tab, setTab] = useState('apercu')
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

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
            <span className="badge" style={{ background: contact.salvation_call ? '#FEF3C7' : '#EFF6FF', color: contact.salvation_call ? '#92400E' : '#3B82F6' }}>
              {contact.salvation_call ? 'Appel au salut' : 'Nouveau visiteur'}
            </span>
            {contact.is_minor && <span className="badge" style={{ background: '#FEF3C7', color: '#92400E' }}>Mineur</span>}
            {!contact.sex && (
              <span className="badge" style={{ background: '#FFF7ED', color: '#9A3412', fontWeight: 700 }}>
                Sexe non renseigné — attribution d'intégrateur impossible
              </span>
            )}
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

      <ProgressTimeline stage={contact.stage} />

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Colonne info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 12 }}>Informations</div>
            <InfoRow Icon={Users} value={SEX_LABEL[contact.sex] || 'Sexe non renseigné'} />
            <InfoRow Icon={Phone} value={contact.phone || '—'} />
            <InfoRow Icon={Mail} value={contact.email || '—'} />
            <InfoRow Icon={MapPin} value={contact.commune || '—'} />
            <InfoRow Icon={Calendar} value={age !== null ? `${age} ans` : '—'} />
            <InfoRow Icon={Calendar} value={contact.first_visit_date ? `Arrivé(e) le ${contact.first_visit_date}` : '—'} />
            {contact.welcomed_by_name && <InfoRow Icon={Users} value={`Connecteur : ${contact.welcomed_by_name}`} />}
            {contact.invited_by && <InfoRow Icon={Users} value={`Invité par : ${contact.invited_by}`} />}
          </div>

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

      {/* ============================================================
          ZONE DANGEREUSE — visible uniquement pour les admins
          ============================================================ */}
      {isAdmin && (
        <div className="card" style={{ marginTop: 24, border: '1px solid #FECACA' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>
            Zone dangereuse
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: '#64748B', maxWidth: 560, lineHeight: 1.5 }}>
              Supprimer définitivement cette fiche et toutes ses données liées.
              Action réservée aux administrateurs, tracée dans le journal des
              suppressions, et <b>irréversible</b>.
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
