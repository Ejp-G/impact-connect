import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import CommunicationsClient from './CommunicationsClient'
export default async function CommunicationsPage() {
  const supabase = createClient()
  const { data:{ session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
  const [{ data: templates }, { data: logs }, { data: contacts }] = await Promise.all([
    supabase.from('communication_templates').select('*').eq('active',true).order('name'),
    supabase.from('communication_logs').select('*,contact:contacts(first_name,last_name)').order('sent_at',{ascending:false}).limit(50),
    supabase.from('contacts').select('id,first_name,last_name,phone,whatsapp,email').eq('status','active').order('last_name').limit(200),
  ])
  return <AppLayout profile={profile} pageId="communications" title="Communications">
    <CommunicationsClient templates={templates||[]} logs={logs||[]} contacts={contacts||[]} />
  </AppLayout>
}
