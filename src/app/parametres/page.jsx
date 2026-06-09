import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import ParametresClient from './ParametresClient'
export default async function ParametresPage() {
  const supabase = createClient()
  const { data:{ session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
  const { data: settingsRows } = await supabase.from('settings').select('*')
  const settings = {}
  settingsRows?.forEach(r => { settings[r.key] = r.value })
  const { data: communes } = await supabase.from('communes').select('*').order('name')
  return (
    <AppLayout profile={profile} pageId="parametres" title="Paramètres">
      <ParametresClient settings={settings} communes={communes||[]} profile={profile} />
    </AppLayout>
  )
}
