import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getProfile(supabase) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
  return p
}

// Cree une demande de validation (n'importe quel utilisateur connecte)
export async function POST(request) {
  const supabase = createClient()
  const profile = await getProfile(supabase)
  if (!profile) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { action_type, target_table, target_id, payload, reason } = await request.json()
  const { data, error } = await supabase.from('change_requests').insert({
    requester_id: profile.id, action_type, target_table, target_id, payload: payload || null, reason: reason || null
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

// Liste les demandes (tous statuts, filtrable par ?status=pending)
export async function GET(request) {
  const supabase = createClient()
  const profile = await getProfile(supabase)
  if (!profile) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  let query = supabase.from('change_requests')
    .select('*, requester:profiles!change_requests_requester_id_fkey(name), reviewer:profiles!change_requests_reviewed_by_fkey(name)')
    .order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// Accepte ou refuse une demande (admin uniquement). Sur acceptation,
// APPLIQUE reellement le changement selon action_type.
export async function PATCH(request) {
  const supabase = createClient()
  const profile = await getProfile(supabase)
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id, decision } = await request.json() // decision: 'approved' | 'rejected'
  if (!['approved', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: 'Décision invalide' }, { status: 400 })
  }

  const { data: reqRow, error: fetchError } = await supabase.from('change_requests').select('*').eq('id', id).single()
  if (fetchError || !reqRow) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  if (reqRow.status !== 'pending') return NextResponse.json({ error: 'Cette demande a déjà été traitée.' }, { status: 400 })

  if (decision === 'approved') {
    const admin = createAdminClient()
    // Applique le changement reel selon le type d'action. Ajouter un
    // nouveau "case" ici pour brancher une nouvelle action sensible sur
    // ce meme workflow, sans toucher au reste de la route.
    if (reqRow.action_type === 'delete_fi') {
      const { error: delError } = await admin.from('familles_impact').delete().eq('id', reqRow.target_id)
      if (delError) return NextResponse.json({ error: `Échec de l'application : ${delError.message}` }, { status: 500 })
    }
  }

  const { error } = await supabase.from('change_requests').update({
    status: decision, reviewed_by: profile.id, reviewed_at: new Date().toISOString()
  }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
