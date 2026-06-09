import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Chaque mardi à 9h — Rappel pilotes FI pour invitations du jeudi
export async function GET() {
  const supabase = createAdminClient()

  // Récupérer les FI du jeudi
  const { data: thursdayFIs } = await supabase.from('familles_impact')
    .select('id, name, pilot_id').eq('day', 'Jeudi').eq('status', 'active')

  for (const fi of thursdayFIs || []) {
    if (!fi.pilot_id) continue

    // Compter les personnes à inviter (stage: invite_fi dans cette commune)
    const { count } = await supabase.from('contacts')
      .select('*', { count:'exact', head:true })
      .eq('fi_id', fi.id).eq('stage', 'invite_fi').eq('status', 'active')

    if (count > 0) {
      await supabase.from('notifications').insert({
        user_id: fi.pilot_id,
        type: 'tuesday_reminder',
        title: '📅 Rappel FI du jeudi',
        message: `Vous avez ${count} personne(s) à inviter pour la ${fi.name} de jeudi.`,
      })
    }
  }

  return NextResponse.json({ success: true, processed: thursdayFIs?.length || 0 })
}
