import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request, { params }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const contactId = params.id
  const { integrator1Id, integrator2Id } = await request.json()

  const { data: contact } = await supabase.from('contacts').select('sex').eq('id', contactId).single()
  if (!contact) return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })

  // Validation serveur : jamais faire confiance uniquement au formulaire.
  // Les deux intégrateurs doivent être du même sexe que le contact et
  // faire partie de l'équipe Suivi (équipe_suivi / responsable_suivi).
  const ids = [integrator1Id, integrator2Id].filter(Boolean)
  if (ids.length) {
    const { data: profs } = await supabase.from('profiles').select('id,sex,role').in('id', ids)
    const invalid = profs?.find(p => p.sex !== contact.sex || !['equipe_suivi', 'responsable_suivi'].includes(p.role))
    if (invalid || profs?.length !== ids.length) {
      return NextResponse.json({
        error: "Les intégrateurs doivent être du même sexe que le nouveau et faire partie de l'équipe Suivi."
      }, { status: 400 })
    }
  }

  if (integrator1Id) {
    await supabase.from('contact_integrators').upsert(
      { contact_id: contactId, integrator_id: integrator1Id, position: 1, assigned_at: new Date().toISOString() },
      { onConflict: 'contact_id,position' }
    )
    // Garde assigned_to synchronise pour ne pas casser les affichages
    // existants (colonne "Agent" de Visiteurs/Pipeline).
    await supabase.from('contacts').update({
      assigned_to: integrator1Id, assignment_date: new Date().toISOString()
    }).eq('id', contactId)
  }

  if (integrator2Id) {
    await supabase.from('contact_integrators').upsert(
      { contact_id: contactId, integrator_id: integrator2Id, position: 2, assigned_at: new Date().toISOString() },
      { onConflict: 'contact_id,position' }
    )
  } else {
    await supabase.from('contact_integrators').delete().eq('contact_id', contactId).eq('position', 2)
  }

  await supabase.from('audit_log').insert({
    action: 'Réattribution manuelle intégrateurs',
    entity_type: 'contact',
    entity_id: contactId,
    details: { integrator1Id, integrator2Id },
    performed_by: session.user.id
  })

  return NextResponse.json({ success: true })
}
