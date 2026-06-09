import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export async function POST(request) {
  const supabase = createClient()
  const { data:{ session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { contactId, channel, content, templateId } = await request.json()
  const { data, error } = await supabase.from('communication_logs').insert({
    contact_id: contactId, channel, content, template_id: templateId||null,
    sent_by: session.user.id, status: 'sent'
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from('contacts').update({ last_contact_at: new Date().toISOString() }).eq('id', contactId)
  return NextResponse.json({ data }, { status: 201 })
}
