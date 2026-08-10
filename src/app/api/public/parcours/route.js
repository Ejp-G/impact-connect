import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST : crée un nouveau parcours dès l'entrée dans le formulaire.
export async function POST(request) {
  const supabase = createAdminClient()
  const body = await request.json().catch(() => ({}))

  const { data, error } = await supabase
    .from('parcours_integration')
    .insert({ form_data: body.formData || {}, current_step: body.currentStep || 0 })
    .select('id, token')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_log').insert({
    action: 'Parcours créé',
    entity_type: 'parcours',
    entity_id: data.id,
    details: {}
  })

  return NextResponse.json({ id: data.id, token: data.token }, { status: 201 })
}

// GET : récupère un parcours existant par token (reprise après fermeture/rechargement).
export async function GET(request) {
  const supabase = createAdminClient()
  const token = new URL(request.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token manquant' }, { status: 400 })

  const { data, error } = await supabase
    .from('parcours_integration')
    .select('id, token, status, current_step, form_data, contact_id')
    .eq('token', token)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Parcours introuvable' }, { status: 404 })
  if (data.contact_id) return NextResponse.json({ error: 'Parcours déjà finalisé' }, { status: 409 })

  return NextResponse.json({ data })
}

// PATCH : sauvegarde progressive (autosave, appelé en debounce côté client).
export async function PATCH(request) {
  const supabase = createAdminClient()
  const body = await request.json().catch(() => ({}))
  const { token, formData, currentStep } = body
  if (!token) return NextResponse.json({ error: 'Token manquant' }, { status: 400 })

  const { data: existing } = await supabase
    .from('parcours_integration')
    .select('id, contact_id')
    .eq('token', token)
    .single()

  if (!existing) return NextResponse.json({ error: 'Parcours introuvable' }, { status: 404 })
  if (existing.contact_id) return NextResponse.json({ error: 'Parcours déjà finalisé' }, { status: 409 })

  const { error } = await supabase
    .from('parcours_integration')
    .update({
      form_data: formData || {},
      current_step: currentStep ?? 0,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', existing.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
