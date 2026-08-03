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
    .select(`
      *, creator:profiles!cultes_created_by_fkey(name),
      conducteur_priere_stars:profiles!cultes_conducteur_priere_stars_id_fkey(name),
      conducteur_priere_debut:profiles!cultes_conducteur_priere_debut_id_fkey(name),
      moderateur:profiles!cultes_moderateur_id_fkey(name),
      referent_jour:profiles!cultes_referent_jour_id_fkey(name),
      orateur:profiles!cultes_orateur_id_fkey(name)
    `)
    .order('date', { ascending: false })
    .limit(104)

  const { data: profiles } = await supabase.from('profiles').select('id,name').eq('active', true).order('name')

  return (
    <AppLayout profile={profile} pageId="accueil" title="Accueil">
      <AccueilClient cultes={cultes || []} profile={profile} profiles={profiles || []} />
    </AppLayout>
  )
}
