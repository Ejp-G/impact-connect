import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import AccueilClient from './AccueilClient'

export default async function AccueilPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()

  const { data: cultes } = await supabase.from('cultes')
    .select('*, creator:profiles!cultes_created_by_fkey(name)')
    .order('date', { ascending: false })
    .limit(104)

  return (
    <AppLayout profile={profile} pageId="accueil" title="Accueil">
      <AccueilClient cultes={cultes || []} profile={profile} />
    </AppLayout>
  )
}
