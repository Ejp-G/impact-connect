// lib/planning-assign.js
//
// Logique d'assignation automatique du planning Accueil & Intégration.
//
// ÉLIGIBILITÉ (calculée PAR DIMANCHE, pas une seule fois pour tout le
// mois) : role equipe_accueil/equipe_suivi (ou secondary_roles),
// active=true, planning_participant != false, et disponibilité réelle
// à CETTE date précise :
//   - integrator_status = 'inactif' → jamais éligible
//   - integrator_status = 'en_pause' sans date de fin → jamais éligible
//   - integrator_status = 'en_pause' avec pause_until < ce dimanche →
//     éligible (la pause est terminée avant cette date)
//   - integrator_status = 'en_pause' avec pause_until >= ce dimanche →
//     pas éligible pour CE dimanche-là, mais peut l'être plus tard
//     dans le même mois si la pause se termine entre-temps
//   - integrator_status = 'en_service' (ou vide) → éligible
//
// ROULEMENT : pour chaque poste, priorité aux personnes qui n'ont
// jamais servi ce mois-ci, puis à celles dont le dernier service est
// le plus ancien. Le dimanche précédent n'est pas "juste exclu" — il
// est simplement la dernière priorité, ce qui évite les répétitions
// même quand le pool est petit.

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

function isEligibleRole(p) {
  return ['equipe_accueil', 'equipe_suivi'].includes(p.role)
    || (p.secondary_roles || []).some(r => ['equipe_accueil', 'equipe_suivi'].includes(r))
}

function isEligibleForDate(p, dateStr) {
  if (!p.active) return false
  if (p.planning_participant === false) return false
  const status = p.integrator_status || 'en_service'
  if (status === 'inactif') return false
  if (status === 'en_pause') {
    if (!p.integrator_pause_until) return false
    return p.integrator_pause_until < dateStr
  }
  return true
}

function getPoolForDate(allProfiles, dateStr) {
  return (allProfiles || []).filter(p => isEligibleRole(p) && isEligibleForDate(p, dateStr))
}

export async function generatePlanningAssignments(supabase, planningId, monthStr) {
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id, name, role, secondary_roles, integrator_status, integrator_pause_until, active, planning_participant')

  const { data: postTypes } = await supabase
    .from('planning_post_types')
    .select('*')
    .eq('active', true)
    .order('sort_order')

  const byName = Object.fromEntries((postTypes || []).map(pt => [pt.name, pt]))
  const coreIds = new Set(Object.values(CORE_NAMES).map(n => byName[n]?.id).filter(Boolean))
  const customPostTypes = (postTypes || []).filter(pt => !coreIds.has(pt.id))

  const sundays = getSundaysOfMonth(monthStr)
  // Dernier jour de service par personne, mis à jour au fil du mois —
  // sert de base au roulement par ancienneté (dimanche ET lundi
  // comptent comme un service).
  const lastServed = {}

  for (const sundayDate of sundays) {
    const dateStr = toDateStr(sundayDate)
    const pool = getPoolForDate(allProfiles, dateStr)

    const { data: sundayRow } = await supabase
      .from('planning_sundays')
      .insert({ planning_id: planningId, date: dateStr })
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

    function pickByRecency(count) {
      const candidates = pool.filter(p => !teamUsed.has(p.id))
      const sorted = [...candidates].sort((a, b) => {
        const da = lastServed[a.id] || '0000-00-00'
        const db = lastServed[b.id] || '0000-00-00'
        if (da !== db) return da < db ? -1 : 1
        return Math.random() - 0.5
      })
      const picked = sorted.slice(0, count)
      picked.forEach(p => { teamUsed.add(p.id); lastServed[p.id] = dateStr })
      return picked
    }

    // 1. Porte (1) — fait aussi Drapeau
    const [portePerson] = pickByRecency(1)
    if (portePerson) {
      addRows(CORE_NAMES.porte, [portePerson])
      addRows(CORE_NAMES.drapeau, [portePerson])
    }

    // 2. Accueil & Intégration (4) — dont Offrandes (2) et Collations (1)
    const accueilPicks = pickByRecency(4)
    addRows(CORE_NAMES.accueil, accueilPicks)

    const offrandesPicks = shuffle(accueilPicks).slice(0, Math.min(2, accueilPicks.length))
    addRows(CORE_NAMES.offrandes, offrandesPicks)

    const remainingForCollation = accueilPicks.filter(p => !offrandesPicks.some(o => o.id === p.id))
    const collationPool = remainingForCollation.length ? remainingForCollation : accueilPicks
    addRows(CORE_NAMES.collations, shuffle(collationPool).slice(0, 1))

    // 3. Activité Accueil avant culte (2) — font aussi Mise en place
    const activitePicks = pickByRecency(2)
    addRows(CORE_NAMES.activite, activitePicks)
    addRows(CORE_NAMES.miseEnPlace, activitePicks)

    // 4. Postes personnalisés
    for (const post of customPostTypes) {
      const picks = pickByRecency(post.default_slots)
      addRows(post.name, picks)
    }

    if (rows.length) await supabase.from('planning_assignments').insert(rows)

    // Lundi suivant : prière (3) + phoning (1), même principe de
    // roulement, éligibilité recalculée pour la date du lundi.
    const mondayDate = nextDay(sundayDate)
    if (mondayDate.getMonth() === sundayDate.getMonth()) {
      const mondayStr = toDateStr(mondayDate)
      const mondayPool = getPoolForDate(allProfiles, mondayStr)
      const { data: mondayRow } = await supabase
        .from('planning_mondays')
        .insert({ planning_id: planningId, date: mondayStr })
        .select().single()

      const mondayTeamUsed = new Set()
      function pickMondayByRecency(count) {
        const candidates = mondayPool.filter(p => !mondayTeamUsed.has(p.id))
        const sorted = [...candidates].sort((a, b) => {
          const da = lastServed[a.id] || '0000-00-00'
          const db = lastServed[b.id] || '0000-00-00'
          if (da !== db) return da < db ? -1 : 1
          return Math.random() - 0.5
        })
        const picked = sorted.slice(0, count)
        picked.forEach(p => { mondayTeamUsed.add(p.id); lastServed[p.id] = mondayStr })
        return picked
      }

      const prayerPicks = pickMondayByRecency(3)
      if (prayerPicks.length) {
        await supabase.from('planning_prayer_assignments').insert(
          prayerPicks.map((p, i) => ({ planning_monday_id: mondayRow.id, profile_id: p.id, position: i + 1 }))
        )
      }
      const phoningPick = pickMondayByRecency(1)
      if (phoningPick.length) {
        await supabase.from('planning_phoning_assignments').insert({
          planning_monday_id: mondayRow.id, profile_id: phoningPick[0].id,
        })
      }
    }
  }
}
