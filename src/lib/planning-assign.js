// lib/planning-assign.js
//
// Logique d'assignation automatique du planning Accueil & Intégration.
// Pool : profiles actifs avec role equipe_accueil/equipe_suivi (ou
// secondary_roles), EXCLUANT integrator_status != 'en_service' — même
// champ que celui géré dans Utilisateurs.
//
// STRUCTURE PAR DIMANCHE (7 personnes au total, pas 13) :
// - Porte (1) — fait AUSSI Drapeau (même personne, deux postes)
// - Accueil & Intégration (4) — 2 d'entre elles font Offrandes,
//   1 fait Collations
// - Activité Accueil avant culte (2) — les mêmes 2 font aussi
//   Mise en place de l'espace intégration
// Total unique par dimanche : 1 (porte/drapeau) + 4 (accueil) + 2
// (activité/mise en place) = 7.
//
// Tout poste personnalisé ajouté plus tard (via "Ajouter un poste")
// reste piochée indépendamment dans le pool restant, en dehors de
// cette équipe fixe de 7 — pour rester flexible sur les évolutions
// futures sans casser cette structure connue.

const CORE_NAMES = {
  porte: 'Porte',
  accueil: 'Accueil & Intégration',
  drapeau: 'Drapeau',
  offrandes: 'Offrandes',
  collations: 'Collations',
  activite: 'Activité Accueil avant culte',
  miseEnPlace: "Mise en place de l'espace intégration",
}

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

// Pioche `count` personnes distinctes du pool, en évitant `excludeIds`.
// Si le pool filtré ne suffit pas, complète en réintégrant des exclus
// plutôt que de laisser un poste vide.
function pickDistinct(pool, count, excludeIds) {
  const available = shuffle(pool.filter(p => !excludeIds.has(p.id)))
  const picked = available.slice(0, count)
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

  const byName = Object.fromEntries((postTypes || []).map(pt => [pt.name, pt]))
  const coreIds = new Set(Object.values(CORE_NAMES).map(n => byName[n]?.id).filter(Boolean))
  const customPostTypes = (postTypes || []).filter(pt => !coreIds.has(pt.id))

  const sundays = getSundaysOfMonth(monthStr)
  let previousSundayIds = new Set()

  for (const sundayDate of sundays) {
    const { data: sundayRow } = await supabase
      .from('planning_sundays')
      .insert({ planning_id: planningId, date: toDateStr(sundayDate) })
      .select().single()

    const rows = []
    const teamUsed = new Set()

    function addRows(postName, people) {
      const pt = byName[postName]
      if (!pt || !people.length) return
      people.forEach((p, i) => rows.push({
        planning_sunday_id: sundayRow.id, post_type_id: pt.id, profile_id: p.id, position: i + 1,
      }))
    }

    // 1. Porte (1) — fait aussi Drapeau
    const [portePerson] = pickDistinct(pool, 1, previousSundayIds)
    if (portePerson) {
      teamUsed.add(portePerson.id)
      addRows(CORE_NAMES.porte, [portePerson])
      addRows(CORE_NAMES.drapeau, [portePerson])
    }

    // 2. Accueil & Intégration (4) — dont Offrandes (2) et Collations (1)
    const accueilPicks = pickDistinct(pool, 4, new Set([...previousSundayIds, ...teamUsed]))
    accueilPicks.forEach(p => teamUsed.add(p.id))
    addRows(CORE_NAMES.accueil, accueilPicks)

    const offrandesPicks = shuffle(accueilPicks).slice(0, Math.min(2, accueilPicks.length))
    addRows(CORE_NAMES.offrandes, offrandesPicks)

    const remainingForCollation = accueilPicks.filter(p => !offrandesPicks.some(o => o.id === p.id))
    const collationPool = remainingForCollation.length ? remainingForCollation : accueilPicks
    const collationPick = shuffle(collationPool).slice(0, 1)
    addRows(CORE_NAMES.collations, collationPick)

    // 3. Activité Accueil avant culte (2) — font aussi Mise en place
    const activitePicks = pickDistinct(pool, 2, new Set([...previousSundayIds, ...teamUsed]))
    activitePicks.forEach(p => teamUsed.add(p.id))
    addRows(CORE_NAMES.activite, activitePicks)
    addRows(CORE_NAMES.miseEnPlace, activitePicks)

    // 4. Postes personnalisés (ajoutés via "Ajouter un poste") — piochés
    // indépendamment, en dehors de l'équipe fixe de 7 du jour.
    for (const post of customPostTypes) {
      const picks = pickDistinct(pool, post.default_slots, new Set([...previousSundayIds, ...teamUsed]))
      addRows(post.name, picks)
    }

    if (rows.length) await supabase.from('planning_assignments').insert(rows)

    previousSundayIds = teamUsed

    // Lundi suivant : prière (3 x 20min) + phoning (1), pool complet,
    // pas de contrainte liée à l'équipe du dimanche.
    const mondayDate = nextDay(sundayDate)
    if (mondayDate.getMonth() === sundayDate.getMonth()) {
      const { data: mondayRow } = await supabase
        .from('planning_mondays')
        .insert({ planning_id: planningId, date: toDateStr(mondayDate) })
        .select().single()

      const prayerPicks = pickDistinct(pool, 3, new Set())
      if (prayerPicks.length) {
        await supabase.from('planning_prayer_assignments').insert(
          prayerPicks.map((p, i) => ({
            planning_monday_id: mondayRow.id, profile_id: p.id, position: i + 1,
          }))
        )
      }
      const phoningPick = pickDistinct(pool, 1, new Set())
      if (phoningPick.length) {
        await supabase.from('planning_phoning_assignments').insert({
          planning_monday_id: mondayRow.id, profile_id: phoningPick[0].id,
        })
      }
    }
  }
}
