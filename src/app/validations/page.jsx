import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import ValidationsClient from './ValidationsClient'

export default async function ValidationsPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: requests } = await supabase.from('change_requests')
    .select('*, requester:profiles!change_requests_requester_id_fkey(name), reviewer:profiles!change_requests_reviewed_by_fkey(name)')
    .order('created_at', { ascending: false })

  return (
    <AppLayout profile={profile} pageId="validations" title="Demandes de validation">
      <ValidationsClient requests={requests || []} />
    </AppLayout>
  )
}
