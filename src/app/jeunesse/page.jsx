import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import JeunesseClient from './JeunesseClient'

export default async function JeunessePage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()

  const { data: mineurs, count } = await supabase.from('contacts')
    .select('id,first_name,last_name,sex,date_of_birth,commune,commune_id,stage,parental_status,phone,parent_first_name,parent_last_name,parent_phone,parent_email,parent_address,parent_relation', { count: 'exact' })
    .eq('is_minor', true).neq('status', 'deleted').order('created_at', { ascending: false })

  const { data: communes } = await supabase.from('communes').select('id,name').eq('active', true).order('name')

  return (
    <AppLayout profile={profile} pageId="jeunesse" title="Module Jeunesse">
      <JeunesseClient mineurs={mineurs || []} count={count || 0} communes={communes || []} />
    </AppLayout>
  )
}
