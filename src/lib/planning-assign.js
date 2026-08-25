// lib/planning-assign.js
//
// Logique d'assignation automatique du planning Accueil & Intégration.
// Pool : profiles actifs avec role equipe_accueil/equipe_suivi (ou
// secondary_roles), EXCLUANT integrator_status='en_pause'/'inactif' —
// même champ que celui géré dans Utilisateurs, aucune notion
// d'indisponibilité séparée pour le planning : une pause déclarée une
// fois se répercute partout (assignation intégrateurs ET planning).

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getSundaysOfMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  const sundays = []
  const d = new Date(y, m - 1, 1)
  while (d.getMonth() === m - 1) {
    if (d.getDay() === 0) sundays.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return sundays
}

function nextDay(date) {
  const d = new Date(date)
  d.setDate(d.getDate() + 1)
  return d
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10)
}

export async function getEligiblePool(supabase) {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, role, secondary_roles, integrator_status, active')
    .eq('active', true)

  return (profiles || []).filter(p => {
    const isEligibleRole = ['equipe_accueil', 'equipe_suivi'].includes(p.role)
      || (p.secondary_roles || []).some(r => ['equipe_accueil', 'equipe_suivi'].includes(r))
    const isAvailable = (p.integrator_status || 'en_service') === 'en_service'
    return isEligibleRole && isAvailable
  })
}

// Pioche `count` personnes dans le pool en évitant `excludeIds` (ceux
// qui ont servi le dimanche précédent — règle du battement). Si le
// pool filtré ne suffit pas, complète en réintégrant les exclus plutôt
// que de laisser un poste vide.
function pickFromPool(pool, count, excludeIds) {
  const fresh = shuffle(pool.filter(p => !excludeIds.has(p.id)))
  const picked = fresh.slice(0, count)
  if (picked.length < count) {
    const fallback = shuffle(pool.filter(p => !picked.some(x => x.id === p.id)))
    picked.push(...fallback.slice(0, count - picked.length))
  }
  return picked
}

export async function generatePlanningAssignments(supabase, planningId, monthStr) {
  const pool = await getEligiblePool(supabase)
  const { data: postTypes } = await supabase
    .from('planning_post_types')
    .select('*')
    .eq('active', true)
    .order('sort_order')

  const sundays = getSundaysOfMonth(monthStr)
  let previousSundayIds = new Set()

  for (const sundayDate of sundays) {
    const { data: sundayRow } = await supabase
      .from('planning_sundays')
      .insert({ planning_id: planningId, date: toDateStr(sundayDate) })
      .select().single()

    const usedThisSunday = new Set()
    for (const post of postTypes) {
      const picked = pickFromPool(pool, post.default_slots, previousSundayIds)
      picked.forEach(p => usedThisSunday.add(p.id))
      if (picked.length) {
        await supabase.from('planning_assignments').insert(
          picked.map((p, i) => ({
            planning_sunday_id: sundayRow.id,
            post_type_id: post.id,
            profile_id: p.id,
            position: i + 1,
          }))
        )
      }
    }
    previousSundayIds = usedThisSunday

    const mondayDate = nextDay(sundayDate)
    if (mondayDate.getMonth() === sundayDate.getMonth()) {
      const { data: mondayRow } = await supabase
        .from('planning_mondays')
        .insert({ planning_id: planningId, date: toDateStr(mondayDate) })
        .select().single()

      const prayerPicks = pickFromPool(pool, 3, new Set())
      if (prayerPicks.length) {
        await supabase.from('planning_prayer_assignments').insert(
          prayerPicks.map((p, i) => ({
            planning_monday_id: mondayRow.id, profile_id: p.id, position: i + 1,
          }))
        )
      }
      const phoningPick = pickFromPool(pool, 1, new Set())
      if (phoningPick.length) {
        await supabase.from('planning_phoning_assignments').insert({
          planning_monday_id: mondayRow.id, profile_id: phoningPick[0].id,
        })
      }
    }
  }
}
