import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
async function checkAdmin(supabase) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false
  const { data: p } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  return p?.role === 'admin'
}

// Le champ profiles.fi_id, saisi sur la page Utilisateurs, n'avait aucun
// effet ailleurs dans l'app : la vraie source de verite pour "qui pilote
// une FIJ" est familles_impact.pilot_id / copilot_id (utilise partout :
// canManage() sur /fi, les notifications, l'affichage "Pilote : X").
// Cette fonction synchronise les deux quand un profil pilote_fi est
// cree/modifie, sans jamais ecraser silencieusement une affectation
// existante — elle prend le premier slot libre (pilote, puis co-pilote)
// et renvoie un message si aucun n'est disponible.
async function syncFiPilotAssignment(supabase, userId, fiId) {
  if (!fiId) return null
  const { data: fi } = await supabase.from('familles_impact')
    .select('id,name,pilot_id,copilot_id').eq('id', fiId).single()
  if (!fi) return null
  if (fi.pilot_id === userId || fi.copilot_id === userId) return null
  if (!fi.pilot_id) {
    await supabase.from('familles_impact').update({ pilot_id: userId }).eq('id', fiId)
    return null
  }
  if (!fi.copilot_id) {
    await supabase.from('familles_impact').update({ copilot_id: userId }).eq('id', fiId)
    return null
  }
  return `"${fi.name}" a deja un pilote et un co-pilote — va sur la page Familles d'Impact pour reorganiser si besoin.`
}

// Quand un pilote quitte une FIJ (fi_id change ou est vide), on le retire
// aussi de familles_impact.pilot_id/copilot_id sur son ancienne FIJ, pour
// eviter qu'elle continue de l'afficher comme pilote.
async function clearOldFiPilotAssignment(supabase, userId, oldFiId) {
  if (!oldFiId) return
  const { data: fi } = await supabase.from('familles_impact')
    .select('id,pilot_id,copilot_id').eq('id', oldFiId).single()
  if (!fi) return
  if (fi.pilot_id === userId) {
    await supabase.from('familles_impact').update({ pilot_id: null }).eq('id', oldFiId)
  } else if (fi.copilot_id === userId) {
    await supabase.from('familles_impact').update({ copilot_id: null }).eq('id', oldFiId)
  }
}
export async function GET() {
  const supabase = createClient()
  if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { data, error } = await supabase.from('profiles')
    .select('*, fi:familles_impact(id,name)').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
export async function POST(request) {
  const supabase = createClient()
  if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { email, password, name, role, sex, fi_id, secondary_roles } = await request.json()
  const admin = createAdminClient()
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { name, role, sex }
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })
  // fi_id et secondary_roles ne sont pas geres par le trigger de creation
  // de profil (base sur user_metadata) : on les met a jour explicitement
  // juste apres la creation du compte.
  const postCreatePatch = {}
  if (fi_id) postCreatePatch.fi_id = fi_id
  if (secondary_roles !== undefined) postCreatePatch.secondary_roles = secondary_roles
  if (Object.keys(postCreatePatch).length > 0) {
    await supabase.from('profiles').update(postCreatePatch).eq('id', authUser.user.id)
  }
  let warning = null
  if (role === 'pilote_fi' && fi_id) {
    warning = await syncFiPilotAssignment(supabase, authUser.user.id, fi_id)
  }
  return NextResponse.json({ data: authUser.user, warning }, { status: 201 })
}
export async function PATCH(request) {
  const supabase = createClient()
  if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { id, password, ...profileUpdates } = await request.json()
  const admin = createAdminClient()
  if (password) {
    await admin.auth.admin.updateUserById(id, { password })
  }
  // Nettoyage : toute valeur vide "" pour un champ UUID doit devenir null
  const uuidFields = ['fi_id', 'pole_id', 'referent_id']
  for (const field of uuidFields) {
    if (profileUpdates[field] === '') {
      profileUpdates[field] = null
    }
  }
  // Si le fi_id change, on recupere l'ancien pour pouvoir liberer son
  // slot pilote/co-pilote avant d'assigner le nouveau.
  let oldFiId = null
  let currentRole = null
  if ('fi_id' in profileUpdates) {
    const { data: current } = await supabase.from('profiles').select('fi_id,role').eq('id', id).single()
    oldFiId = current?.fi_id || null
    currentRole = profileUpdates.role || current?.role || null
  }
  const { data, error } = await supabase.from('profiles').update(profileUpdates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  let warning = null
  if ('fi_id' in profileUpdates && currentRole === 'pilote_fi') {
    if (oldFiId && oldFiId !== profileUpdates.fi_id) {
      await clearOldFiPilotAssignment(supabase, id, oldFiId)
    }
    if (profileUpdates.fi_id) {
      warning = await syncFiPilotAssignment(supabase, id, profileUpdates.fi_id)
    }
  }
  return NextResponse.json({ data, warning })
}
export async function DELETE(request) {
  const supabase = createClient()
  if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { id } = await request.json()
  const admin = createAdminClient()
  await admin.auth.admin.deleteUser(id)
  return NextResponse.json({ success: true })
}
