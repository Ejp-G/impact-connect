'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Calendar, Trash2, Star, Users, Sparkles, FileText, X, ChevronLeft, ChevronRight } from '@/lib/icons'

const TYPE_CULTE_OPTIONS = ['CDJP', 'Dimanche', 'Veillée', 'Conférence', 'Autre']
const STEPS = [
  { label: 'Informations générales', Icon: Calendar },
  { label: 'Service STAR', Icon: Star },
  { label: 'Fréquentation', Icon: Users },
  { label: 'Vie du culte', Icon: Sparkles },
  { label: 'Compte rendu', Icon: FileText },
]

function todayISO() { return new Date().toISOString().slice(0, 10) }

const emptyForm = {
  date: todayISO(), heure_debut: '', heure_fin: '', type_culte: 'Dimanche',
  stars_total: '', stars_hommes: '', stars_femmes: '',
  conducteur_priere_stars_id: '', conducteur_priere_debut_id: '', moderateur_id: '', referent_jour_id: '', orateur_id: '',
  autres_stars: [],
  presents: '', freq_hommes: '', freq_femmes: '', freq_jeunes: '', freq_enfants: '', freq_bebes: '', freq_autre: '',
  titre_message: '', nouveaux_comptes: '', appels_au_salut_comptes: '',
  points_positifs: '', points_negatifs: '', actions_amelioration: '', compte_rendu: '',
}

function toNumOrNull(v) { return v === '' || v === null || v === undefined ? null : Number(v) }

export default function AccueilClient({ cultes, profile, profiles }) {
  const router = useRouter()
  const supabase = createClient()
  const [showWizard, setShowWizard] = useState(false)
  const [step, setStep] = useState(0)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [viewingCulte, setViewingCulte] = useState(null)

  const [filterYear, setFilterYear] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterType, setFilterType] = useState('')

  const filteredCultes = useMemo(() => {
    return cultes.filter(c => {
      if (filterYear && new Date(c.date).getFullYear() !== Number(filterYear)) return false
      if (filterMonth && new Date(c.date).getMonth() + 1 !== Number(filterMonth)) return false
      if (filterType && c.type_culte !== filterType) return false
      return true
    })
  }, [cultes, filterYear, filterMonth, filterType])

  const years = useMemo(() => [...new Set(cultes.map(c => new Date(c.date).getFullYear()))].sort((a, b) => b - a), [cultes])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setStep(0)
    setShowWizard(true)
  }

  function openEdit(culte) {
    setEditing(culte)
    setForm({
      date: culte.date, heure_debut: culte.heure_debut || '', heure_fin: culte.heure_fin || '', type_culte: culte.type_culte || 'Dimanche',
      stars_total: culte.stars_total ?? '', stars_hommes: culte.stars_hommes ?? '', stars_femmes: culte.stars_femmes ?? '',
      conducteur_priere_stars_id: culte.conducteur_priere_stars_id || '', conducteur_priere_debut_id: culte.conducteur_priere_debut_id || '',
      moderateur_id: culte.moderateur_id || '', referent_jour_id: culte.referent_jour_id || '', orateur_id: culte.orateur_id || '',
      autres_stars: culte.autres_stars || [],
      presents: culte.presents ?? '', freq_hommes: culte.freq_hommes ?? '', freq_femmes: culte.freq_femmes ?? '',
      freq_jeunes: culte.freq_jeunes ?? '', freq_enfants: culte.freq_enfants ?? '', freq_bebes: culte.freq_bebes ?? '',
      freq_autre: culte.freq_autre ?? '',
      titre_message: culte.titre_message || '', nouveaux_comptes: culte.nouveaux_comptes ?? '', appels_au_salut_comptes: culte.appels_au_salut_comptes ?? '',
      points_positifs: culte.points_positifs || '', points_negatifs: culte.points_negatifs || '',
      actions_amelioration: culte.actions_amelioration || '', compte_rendu: culte.compte_rendu || '',
    })
    setError('')
    setStep(0)
    setViewingCulte(null)
    setShowWizard(true)
  }

  function toggleAutreStar(id) {
    setForm(prev => ({
      ...prev,
      autres_stars: prev.autres_stars.includes(id) ? prev.autres_stars.filter(x => x !== id) : [...prev.autres_stars, id]
    }))
  }

  const freqSum = ['freq_hommes', 'freq_femmes', 'freq_jeunes', 'freq_enfants', 'freq_bebes', 'freq_autre']
    .reduce((sum, k) => sum + (Number(form[k]) || 0), 0)

  async function save() {
    if (!form.date) { setError('La date est obligatoire.'); return }
    setSaving(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const payload = {
      date: form.date, heure_debut: form.heure_debut || null, heure_fin: form.heure_fin || null, type_culte: form.type_culte,
      stars_total: toNumOrNull(form.stars_total), stars_hommes: toNumOrNull(form.stars_hommes), stars_femmes: toNumOrNull(form.stars_femmes),
      conducteur_priere_stars_id: form.conducteur_priere_stars_id || null, conducteur_priere_debut_id: form.conducteur_priere_debut_id || null,
      moderateur_id: form.moderateur_id || null, referent_jour_id: form.referent_jour_id || null, orateur_id: form.orateur_id || null,
      autres_stars: form.autres_stars.length ? form.autres_stars : null,
      presents: toNumOrNull(form.presents), freq_hommes: toNumOrNull(form.freq_hommes), freq_femmes: toNumOrNull(form.freq_femmes),
      freq_jeunes: toNumOrNull(form.freq_jeunes), freq_enfants: toNumOrNull(form.freq_enfants), freq_bebes: toNumOrNull(form.freq_bebes),
      freq_autre: toNumOrNull(form.freq_autre),
      titre_message: form.titre_message || null,
      nouveaux_comptes: toNumOrNull(form.nouveaux_comptes), appels_au_salut_comptes: toNumOrNull(form.appels_au_salut_comptes),
      points_positifs: form.points_positifs || null, points_negatifs: form.points_negatifs || null,
      actions_amelioration: form.actions_amelioration || null, compte_rendu: form.compte_rendu || null,
      updated_at: new Date().toISOString(),
    }
    if (editing) payload.updated_by = session?.user?.id
    else payload.created_by = session?.user?.id

    const query = editing
      ? supabase.from('cultes').update(payload).eq('id', editing.id)
      : supabase.from('cultes').insert(payload)
    const { error: err } = await query
    setSaving(false)
    if (err) {
      setError(err.code === '23505' ? 'Un culte existe déjà pour cette date. Modifiez-le plutôt.' : err.message)
      return
    }
    setShowWizard(false)
    router.refresh()
  }

  async function deleteCulte(culte) {
    if (!confirm(`Supprimer le culte du ${new Date(culte.date).toLocaleDateString('fr-FR')} ? Cette action est irréversible.`)) return
    const { error: err } = await supabase.from('cultes').delete().eq('id', culte.id)
    if (err) { alert(err.message); return }
    router.refresh()
  }

  const nameById = (id) => profiles.find(p => p.id === id)?.name || '—'

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={selectStyle}>
            <option value="">Toutes les années</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={selectStyle}>
            <option value="">Tous les mois</option>
            {['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'].map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectStyle}>
            <option value="">Tous les types</option>
            {TYPE_CULTE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button onClick={openCreate} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} strokeWidth={2} /> Nouveau culte
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr><th>Date</th><th>Présents</th><th>Nouveaux</th><th>Appels au salut</th><th>Compte rendu</th><th>Enregistré par</th><th></th></tr>
          </thead>
          <tbody>
            {filteredCultes.map(c => (
              <tr key={c.id} onClick={() => setViewingCulte(c)} style={{ cursor: 'pointer' }}>
                <td style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={13} strokeWidth={2} color="var(--gy)" />
                  {new Date(c.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td style={{ fontSize: 13 }}>{c.presents ?? '—'}</td>
                <td style={{ fontSize: 13 }}>{c.nouveaux_comptes ?? '—'}</td>
                <td style={{ fontSize: 13 }}>{c.appels_au_salut_comptes ?? '—'}</td>
                <td style={{ fontSize: 12, color: 'var(--gd)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.compte_rendu || '—'}</td>
                <td style={{ fontSize: 11, color: 'var(--gy)' }}>{c.creator?.name || '—'}</td>
                <td onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(c)} style={{ background: '#EFF6FF', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', display: 'flex' }}>
                      <Pencil size={13} strokeWidth={2} color="#3B82F6" />
                    </button>
                    <button onClick={() => deleteCulte(c)} style={{ background: '#FEF2F2', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', display: 'flex' }}>
                      <Trash2 size={13} strokeWidth={2} color="#DC2626" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredCultes.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--gy)' }}>Aucun culte enregistré pour le moment.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {viewingCulte && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewingCulte(null)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Culte du {new Date(viewingCulte.date).toLocaleDateString('fr-FR')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => openEdit(viewingCulte)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Pencil size={13} strokeWidth={2} /> Modifier</button>
                <button onClick={() => setViewingCulte(null)} style={{ width: 32, height: 32, borderRadius: 8, background: '#F1F5F9', border: 'none', cursor: 'pointer' }}><X size={16} strokeWidth={2} /></button>
              </div>
            </div>

            <ViewSection title="Informations générales">
              <ViewRow label="Type" value={viewingCulte.type_culte} />
              <ViewRow label="Horaires" value={`${viewingCulte.heure_debut || '—'} à ${viewingCulte.heure_fin || '—'}`} />
            </ViewSection>
            <ViewSection title="Service STAR">
              <ViewRow label="Stars (total)" value={viewingCulte.stars_total} />
              <ViewRow label="Hommes / Femmes" value={`${viewingCulte.stars_hommes ?? '—'} / ${viewingCulte.stars_femmes ?? '—'}`} />
              <ViewRow label="Conducteur prière Stars" value={viewingCulte.conducteur_priere_stars?.name} />
              <ViewRow label="Conducteur prière début" value={viewingCulte.conducteur_priere_debut?.name} />
              <ViewRow label="Modérateur" value={viewingCulte.moderateur?.name} />
              <ViewRow label="Référent du jour" value={viewingCulte.referent_jour?.name} />
              <ViewRow label="Orateur" value={viewingCulte.orateur?.name} />
              <ViewRow label="Autres Stars" value={(viewingCulte.autres_stars || []).map(nameById).join(', ') || '—'} />
            </ViewSection>
            <ViewSection title="Fréquentation">
              <ViewRow label="Total auditorium" value={viewingCulte.presents} />
              <ViewRow label="Hommes / Femmes" value={`${viewingCulte.freq_hommes ?? '—'} / ${viewingCulte.freq_femmes ?? '—'}`} />
              <ViewRow label="Jeunes / Enfants / Bébés" value={`${viewingCulte.freq_jeunes ?? '—'} / ${viewingCulte.freq_enfants ?? '—'} / ${viewingCulte.freq_bebes ?? '—'}`} />
              <ViewRow label="Tatas / Tontons" value={`${viewingCulte.freq_tatas ?? '—'} / ${viewingCulte.freq_tontons ?? '—'}`} />
            </ViewSection>
            <ViewSection title="Vie du culte">
              <ViewRow label="Titre / Thème" value={viewingCulte.titre_message} />
              <ViewRow label="Appels au salut" value={viewingCulte.appels_au_salut_comptes} />
              <ViewRow label="Nouveaux" value={viewingCulte.nouveaux_comptes} />
            </ViewSection>
            <ViewSection title="Compte rendu" last>
              <ViewRow label="Points positifs" value={viewingCulte.points_positifs} block />
              <ViewRow label="Points négatifs" value={viewingCulte.points_negatifs} block />
              <ViewRow label="Actions d'amélioration" value={viewingCulte.actions_amelioration} block />
              <ViewRow label="Commentaires" value={viewingCulte.compte_rendu} block />
            </ViewSection>
          </div>
        </div>
      )}

      {showWizard && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowWizard(false)}>
          <div className="modal" style={{ maxWidth: 620 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{editing ? 'Modifier le culte' : 'Nouveau culte'}</div>
              <button onClick={() => setShowWizard(false)} style={{ width: 32, height: 32, borderRadius: 8, background: '#F1F5F9', border: 'none', cursor: 'pointer' }}><X size={16} strokeWidth={2} /></button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {STEPS.map((s, i) => (
                <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ height: 4, borderRadius: 2, background: i <= step ? 'var(--n)' : '#E2E8F0', marginBottom: 6, transition: 'background .3s' }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: i === step ? 'var(--n)' : 'var(--gy)' }}>
                    <s.Icon size={12} strokeWidth={2} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--n)', marginBottom: 16 }}>{STEPS[step].label}</div>

            {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{error}</div>}

            {step === 0 && (
              <div>
                <div className="g2">
                  <div className="form-group"><label className="form-label">Date du culte</label><input type="date" className="form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} disabled={!!editing} /></div>
                  <div className="form-group"><label className="form-label">Type de culte</label>
                    <select className="form-input" value={form.type_culte} onChange={e => setForm({ ...form, type_culte: e.target.value })}>
                      {TYPE_CULTE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="g2">
                  <div className="form-group"><label className="form-label">Heure de début</label><input type="time" className="form-input" value={form.heure_debut} onChange={e => setForm({ ...form, heure_debut: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Heure de fin</label><input type="time" className="form-input" value={form.heure_fin} onChange={e => setForm({ ...form, heure_fin: e.target.value })} /></div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <div className="g2">
                  <div className="form-group"><label className="form-label">Nombre total de Stars</label><input type="number" min={0} className="form-input" value={form.stars_total} onChange={e => setForm({ ...form, stars_total: e.target.value })} /></div>
                </div>
                <div className="g2">
                  <div className="form-group"><label className="form-label">Hommes</label><input type="number" min={0} className="form-input" value={form.stars_hommes} onChange={e => setForm({ ...form, stars_hommes: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Femmes</label><input type="number" min={0} className="form-input" value={form.stars_femmes} onChange={e => setForm({ ...form, stars_femmes: e.target.value })} /></div>
                </div>
                {[
                  ['conducteur_priere_stars_id', 'Conducteur de la prière des Stars'],
                  ['conducteur_priere_debut_id', 'Conducteur de la prière du début'],
                  ['moderateur_id', 'Modérateur'],
                  ['referent_jour_id', 'Référent du jour'],
                  ['orateur_id', 'Orateur'],
                ].map(([key, label]) => (
                  <div key={key} className="form-group"><label className="form-label">{label}</label>
                    <select className="form-input" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}>
                      <option value="">— Sélectionner —</option>
                      {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                ))}
                <div className="form-group"><label className="form-label">Autres Stars ayant servi</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 140, overflowY: 'auto', border: '1px solid var(--br)', borderRadius: 10, padding: 10 }}>
                    {profiles.map(p => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, background: form.autres_stars.includes(p.id) ? 'rgba(11,61,145,.08)' : 'transparent' }}>
                        <input type="checkbox" checked={form.autres_stars.includes(p.id)} onChange={() => toggleAutreStar(p.id)} style={{ width: 14, height: 14 }} />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <div className="form-group"><label className="form-label">Nombre total dans l'auditorium</label><input type="number" min={0} className="form-input" value={form.presents} onChange={e => setForm({ ...form, presents: e.target.value })} /></div>
                <div className="g2">
                  <div className="form-group"><label className="form-label">Hommes</label><input type="number" min={0} className="form-input" value={form.freq_hommes} onChange={e => setForm({ ...form, freq_hommes: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Femmes</label><input type="number" min={0} className="form-input" value={form.freq_femmes} onChange={e => setForm({ ...form, freq_femmes: e.target.value })} /></div>
                </div>
                <div className="g2">
                  <div className="form-group"><label className="form-label">Jeunes</label><input type="number" min={0} className="form-input" value={form.freq_jeunes} onChange={e => setForm({ ...form, freq_jeunes: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Enfants</label><input type="number" min={0} className="form-input" value={form.freq_enfants} onChange={e => setForm({ ...form, freq_enfants: e.target.value })} /></div>
                </div>
                <div className="g2">
                  <div className="form-group"><label className="form-label">Bébés</label><input type="number" min={0} className="form-input" value={form.freq_bebes} onChange={e => setForm({ ...form, freq_bebes: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Tatas</label><input type="number" min={0} className="form-input" value={form.freq_tatas} onChange={e => setForm({ ...form, freq_tatas: e.target.value })} /></div>
                </div>
                <div className="form-group"><label className="form-label">Tontons</label><input type="number" min={0} className="form-input" value={form.freq_tontons} onChange={e => setForm({ ...form, freq_tontons: e.target.value })} /></div>
                <div style={{ fontSize: 12, color: freqSum && Number(form.presents) && freqSum !== Number(form.presents) ? '#D97706' : 'var(--gy)', background: '#F8FAFC', borderRadius: 8, padding: '8px 12px' }}>
                  Total calculé depuis la répartition : <b>{freqSum}</b>
                  {form.presents && Number(form.presents) !== freqSum && ' (différent du total auditorium saisi — vérifiez si besoin)'}
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <div className="form-group"><label className="form-label">Titre ou thème du message</label><input className="form-input" value={form.titre_message} onChange={e => setForm({ ...form, titre_message: e.target.value })} /></div>
                <div className="g2">
                  <div className="form-group"><label className="form-label">Nombre d'appels au salut</label><input type="number" min={0} className="form-input" value={form.appels_au_salut_comptes} onChange={e => setForm({ ...form, appels_au_salut_comptes: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Nombre de nouveaux</label><input type="number" min={0} className="form-input" value={form.nouveaux_comptes} onChange={e => setForm({ ...form, nouveaux_comptes: e.target.value })} /></div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <div className="form-group"><label className="form-label">Points positifs</label><textarea className="form-input" rows={3} style={{ resize: 'vertical' }} value={form.points_positifs} onChange={e => setForm({ ...form, points_positifs: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Points négatifs</label><textarea className="form-input" rows={3} style={{ resize: 'vertical' }} value={form.points_negatifs} onChange={e => setForm({ ...form, points_negatifs: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Actions d'amélioration pour le prochain culte</label><textarea className="form-input" rows={3} style={{ resize: 'vertical' }} value={form.actions_amelioration} onChange={e => setForm({ ...form, actions_amelioration: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Commentaires</label><textarea className="form-input" rows={3} style={{ resize: 'vertical' }} value={form.compte_rendu} onChange={e => setForm({ ...form, compte_rendu: e.target.value })} /></div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              {step > 0 && <button onClick={() => setStep(s => s - 1)} className="btn btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><ChevronLeft size={14} strokeWidth={2} /> Précédent</button>}
              {step < STEPS.length - 1 ? (
                <button onClick={() => setStep(s => s + 1)} className="btn btn-primary" style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>Suivant <ChevronRight size={14} strokeWidth={2} /></button>
              ) : (
                <button onClick={save} disabled={saving} className="btn btn-primary" style={{ flex: 2 }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ViewSection({ title, children, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 18, paddingBottom: last ? 0 : 18, borderBottom: last ? 'none' : '1px solid #F1F5F9' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--n)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}
function ViewRow({ label, value, block }) {
  return (
    <div style={{ display: block ? 'block' : 'flex', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--gy)', marginBottom: block ? 4 : 0, flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--gd)', fontWeight: block ? 400 : 600, whiteSpace: block ? 'pre-wrap' : 'nowrap' }}>{value || '—'}</div>
    </div>
  )
}

const selectStyle = { padding: '8px 12px', borderRadius: 10, border: '1px solid var(--br)', fontSize: 12, fontFamily: 'inherit', background: '#fff', color: 'var(--gd)' }
