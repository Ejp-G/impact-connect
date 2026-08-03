import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import VisiteursClient from './VisiteursClient'

// Normalisation pour la détection de doublons
const normName = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
const normPhone = p => (p || '').replace(/\D/g, '')

export default async function VisiteursPage({ searchParams }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
  const stage = searchParams?.stage || null
  const alert = searchParams?.alert || null

  // CORRECTIF : l'ancienne limite de 100 fiches cachait les visiteurs
  // les plus anciens (liste, recherche ET compteurs faux). On charge
  // désormais l'ensemble des fiches actives (plafond de sécurité 1000).
  // Ajouts au select : salvation_call (le filtre "Appel au salut" le
  // lisait sans qu'il soit chargé) et les intégrateurs (pour le filtre
  // "Sans intégrateur").
  let query = supabase.from('contacts')
    .select(`id,first_name,last_name,sex,phone,email,commune,quartier,stage,integration_score,alert_level,is_minor,created_at,first_visit_date,contact_preference,salvation_call,
             fi:familles_impact(id,name), agent:profiles!contacts_assigned_to_fkey(id,name),
             integrators:contact_integrators(position)`)
    .eq('status','active').order('created_at',{ascending:false}).limit(1000)
  if (stage) query = query.eq('stage', stage)
  if (alert) query = query.eq('alert_level', alert)
  const { data: contacts } = await query
  const { data: fis } = await supabase.from('familles_impact').select('id,name').eq('status','active')
  const { data: communes } = await supabase.from('communes').select('id,name').eq('active',true).order('name')

  // ─── Détection des doublons potentiels ───
  // Deux fiches sont suspectes si elles partagent le même nom complet
  // (insensible à la casse et aux accents) ou le même téléphone
  // (chiffres uniquement). Les groupes qui se recoupent sont fusionnés.
  const byKey = {}
  for (const c of contacts || []) {
    const n = normName(`${c.first_name} ${c.last_name}`)
    if (n) byKey[`n:${n}`] = [...(byKey[`n:${n}`] || []), c.id]
    const p = normPhone(c.phone)
    if (p.length >= 6) byKey[`p:${p}`] = [...(byKey[`p:${p}`] || []), c.id]
  }
  const rawGroups = Object.entries(byKey)
    .filter(([, ids]) => new Set(ids).size > 1)
    .map(([key, ids]) => ({ reason: key.startsWith('n:') ? 'même nom' : 'même téléphone', ids: [...new Set(ids)] }))
  const merged = []
  for (const g of rawGroups) {
    const hit = merged.find(m => m.ids.some(id => g.ids.includes(id)))
    if (hit) {
      hit.ids = [...new Set([...hit.ids, ...g.ids])]
      if (!hit.reasons.includes(g.reason)) hit.reasons.push(g.reason)
    } else {
      merged.push({ ids: [...g.ids], reasons: [g.reason] })
    }
  }
  const duplicates = merged.map(m => ({
    reasons: m.reasons,
    contacts: m.ids.map(id => {
      const c = (contacts || []).find(x => x.id === id)
      return {
        id,
        name: `${c.first_name} ${c.last_name}`,
        phone: c.phone,
        stage: c.stage,
        score: c.integration_score,
        created_at: c.created_at,
        first_visit_date: c.first_visit_date,
      }
    }),
  }))

  // ─── Statistiques réelles, calculées sur TOUTES les fiches actives ───
  const todayStr = new Date().toISOString().split('T')[0]
  const all = contacts || []
  const stats = {
    total: all.length,
    alerts: all.filter(c => c.alert_level === 'red').length,
    today: all.filter(c => c.first_visit_date === todayStr).length,
    mineurs: all.filter(c => c.is_minor).length,
    hommes: all.filter(c => c.sex === 'M').length,
    femmes: all.filter(c => c.sex === 'F').length,
    sansSexe: all.filter(c => !c.sex).length,
    sansIntegrateur: all.filter(c => !(c.integrators?.length)).length,
    doublons: duplicates.reduce((n, g) => n + g.contacts.length, 0),
  }

  return (
    <AppLayout profile={profile} pageId="visiteurs" title="Visiteurs & Contacts">
      <VisiteursClient contacts={all} stats={stats} fis={fis||[]} communes={communes||[]} profile={profile} duplicates={duplicates} />
    </AppLayout>
  )
}
