import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const planningId = searchParams.get('planningId')
  if (!planningId) return NextResponse.json({ error: 'planningId requis' }, { status: 400 })

  const { data } = await supabase.from('audit_log')
    .select('id, action, details, created_at, performed_by:profiles(name)')
    .eq('entity_type', 'planning').eq('entity_id', planningId)
    .order('created_at', { ascending: false })
    .limit(100)

  return NextResponse.json({ history: data || [] })
}
