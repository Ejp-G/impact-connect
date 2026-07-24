import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkStageTransition } from '@/lib/stageRules'

export async function PATCH(request, { params }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = params
  const { newStage } = await request.json()
  if (!newStage) return NextResponse.json({ error: 'newStage requis' }, { status: 400 })

  const { data: contact, error: fetchError } = await supabase
    .from('contacts')
    .select('id, stage, fi_id, fi_contacted, fi_whatsapp_added, baptism_date, last_contact_at, first_name, last_name')
    .eq('id', id).single()
  if (fetchError || !contact) return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })

  const { count: presentCount } = await supabase
    .from('fi_attendance')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', id)
    .eq('present', true)

  const check = checkStageTransition(contact, { presentCount: presentCount || 0 }, newStage)

  const { error: updateError } = await supabase
    .from('contacts')
    .update({ stage: newStage, stage_updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await supabase.from('audit_log').insert({
    action: 'Changement étape pipeline',
    entity_type: 'contact',
    entity_id: id,
    performed_by: session.user.id,
    details: { from: contact.stage, to: newStage, warning: check.ok ? null : check.reason }
  })

  return NextResponse.json({ success: true, warning: check.ok ? null : check.reason })
}
