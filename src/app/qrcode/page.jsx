import { createAdminClient } from '@/lib/supabase/server'
import QRFormClient from './QRFormClient'

// Page publique : createAdminClient obligatoire, pas de session ici.
export default async function QRFormPage() {
  const supabase = createAdminClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .in('role', ['integrateur', 'equipe_accueil', 'equipe_suivi'])
    .order('name')

  const [{ data: communes }, { data: mappings }] = await Promise.all([
    supabase.from('communes').select('id,name').eq('active', true).order('name'),
    supabase.from('commune_fi_mapping').select('commune_id,quartier'),
  ])

  // Construit commune_id -> liste de quartiers (dedupliquee, triee) a
  // partir du champ texte "quartier" (separe par virgules) deja saisi
  // pour chaque FIJ. Aucune nouvelle table necessaire.
  const quartiersByCommune = {}
  for (const m of mappings || []) {
    if (!m.commune_id || !m.quartier) continue
    const parts = m.quartier.split(',').map(s => s.trim()).filter(Boolean)
    if (!quartiersByCommune[m.commune_id]) quartiersByCommune[m.commune_id] = new Set()
    parts.forEach(p => quartiersByCommune[m.commune_id].add(p))
  }
  const communeQuartiers = Object.fromEntries(
    Object.entries(quartiersByCommune).map(([id, set]) => [id, [...set].sort((a, b) => a.localeCompare(b, 'fr'))])
  )

  return (
    <QRFormClient
      welcomeTeam={profiles || []}
      communes={communes || []}
      communeQuartiers={communeQuartiers}
    />
  )
}
