import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function checkAdmin(supabase) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false
  const { data: p } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  return p?.role === 'admin'
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
  const { email, password, name, role, sex, fi_id } = await request.json()
  const admin = createAdminClient()
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { name, role, sex }
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })
  if (fi_id) {
    await supabase.from('profiles').update({ fi_id }).eq('id', authUser.user.id)
  }
  return NextResponse.json({ data: authUser.user }, { status: 201 })
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

  const { data, error } = await supabase.from('profiles').update(profileUpdates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(request) {
  const supabase = createClient()
  if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { id } = await request.json()
  const admin = createAdminClient()
  await admin.auth.admin.deleteUser(id)
  return NextResponse.json({ success: true })
}
