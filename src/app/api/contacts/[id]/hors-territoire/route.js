import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Meme pattern que /api/contacts/[id]/stage/route.js : verification
// session, ecriture directe, tracage audit_log. hors_territoire est
// volontairement independant de contacts.stage — jamais mélangé au
// pipeline classique.
export async function PATCH(request, { params }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = params
  const { horsTerritoire } = await request.json()
  if (typeof horsTerritoire !== 'boolean') {
    return NextResponse.json({ error: 'horsTerritoire (boolean) requis' }, { status: 400 })
  }

  const { data: contact, error: fetchError } = await supabase
    .from('contacts')
    .select('id, hors_territoire, first_name, last_name')
    .eq('id', id).single()
  if (fetchError || !contact) return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })

  const { error: updateError } = await supabase
    .from('contacts')
    .update({
      hors_territoire: horsTerritoire,
      hors_territoire_since: horsTerritoire ? new Date().toISOString() : null,
    })
    .eq('id', id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await supabase.from('audit_log').insert({
    action: horsTerritoire ? 'Marqué hors territoire' : 'Retiré du statut hors territoire',
    entity_type: 'contact',
    entity_id: id,
    performed_by: session.user.id,
    details: { from: contact.hors_territoire, to: horsTerritoire }
  })

  return NextResponse.json({ success: true })
}
