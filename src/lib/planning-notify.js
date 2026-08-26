// lib/planning-notify.js
//
// Rappels hebdomadaires de service (planning Accueil & Intégration).
//
// Chaque lundi porte DEUX informations temporellement distinctes :
// - la prière/phoning de CE lundi (liée au dimanche d'hier, déjà passé)
// - le service du dimanche À VENIR (dans 6 jours)
// Le cron du lundi matin combine les deux si applicable. Le cron du
// vendredi ne concerne QUE le service du dimanche à venir — une
// personne qui fait uniquement la prière du lundi suivant (sans
// servir dimanche) ne reçoit rien le vendredi.

import { addDays } from './push-weekly'

export function nextSundayFrom(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z')
  const day = d.getUTCDay() // 0 = dimanche
  const diff = day === 0 ? 0 : 7 - day
  return addDays(dateStr, diff)
}

// { [profile_id]: ['Porte', 'Accueil & Intégration', ...] }
export async function getSundayAssignments(supabase, dateStr) {
  const { data } = await supabase
    .from('planning_sundays')
    .select('id, date, assignments:planning_assignments(profile_id, post_type:planning_post_types(name))')
    .eq('date', dateStr)
    .maybeSingle()

  const byProfile = {}
  ;(data?.assignments || []).forEach(a => {
    if (!a.profile_id || !a.post_type?.name) return
    ;(byProfile[a.profile_id] = byProfile[a.profile_id] || []).push(a.post_type.name)
  })
  Object.keys(byProfile).forEach(id => { byProfile[id] = [...new Set(byProfile[id])] })
  return byProfile
}

// { [profile_id]: { prayer: {duration}|null, phoning: boolean } }
export async function getMondayAssignments(supabase, dateStr) {
  const { data } = await supabase
    .from('planning_mondays')
    .select(`
      id, date,
      prayer:planning_prayer_assignments(profile_id, duration_minutes),
      phoning:planning_phoning_assignments(profile_id)
    `)
    .eq('date', dateStr)
    .maybeSingle()

  const byProfile = {}
  function ensure(id) { return (byProfile[id] = byProfile[id] || { prayer: null, phoning: false }) }
  ;(data?.prayer || []).forEach(p => { if (p.profile_id) ensure(p.profile_id).prayer = { duration: p.duration_minutes || 20 } })
  ;(data?.phoning || []).forEach(p => { if (p.profile_id) ensure(p.profile_id).phoning = true })
  return byProfile
}

export function formatFr(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
}
