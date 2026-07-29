import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import ContactProfileClient from './ContactProfileClient'

export default async function ContactProfilePage({ params }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()

  const contactId = params.id

  const { data: contact } = await supabase.from('contacts')
    .select(`
      *,
      fi:familles_impact(id,name,day,time),
      agent:profiles!contacts_assigned_to_fkey(id,name),
      welcomed_by:profiles!contacts_welcomed_by_fkey(name)
    `)
    .eq('id', contactId).single()

  if (!contact) notFound()

  const { data: integratorPair } = await supabase.from('contact_integrators')
    .select('position, integrator:profiles(id,name,email,phone)')
    .eq('contact_id', contactId).order('position')

  const [
    { data: auditRows },
    { data: reportRows },
    { data: commRows },
    { data: needRows },
    attendanceResult,
  ] = await Promise.all([
    supabase.from('audit_log').select('id,action,details,created_at,performed_by:profiles(name)')
      .eq('entity_type', 'contact').eq('entity_id', contactId).order('created_at', { ascending: false }).limit(30),
    supabase.from('integrator_reports').select('id,contacted_at,method,result,duration_minutes,notes,next_action,next_contact_date,integrator:profiles(name)')
      .eq('contact_id', contactId).order('contacted_at', { ascending: false }),
    supabase.from('communication_logs').select('id,sent_at,channel,content,direction,status')
      .eq('contact_id', contactId).order('sent_at', { ascending: false }),
    supabase.from('contact_needs').select('id,category,note,status,detected_at,detected_by:profiles(name),action_note,responsible_id,resolved_at')
      .eq('contact_id', contactId).order('detected_at', { ascending: false }),
    contact.fi_id
      ? supabase.from('fi_attendance').select('date,present,notes').eq('contact_id', contactId).order('date', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])
  const attendanceRows = attendanceResult.data

  // Timeline unifiee : fusionne toutes les sources existantes, aucune
  // nouvelle table necessaire. C'est le coeur de la vue "HubSpot-like".
  const timeline = [
    ...(auditRows || []).map(r => ({ type: 'audit', date: r.created_at, title: r.action, sub: r.performed_by?.name, details: r.details })),
    ...(reportRows || []).map(r => ({ type: 'report', date: r.contacted_at, title: `Contact (${r.method})`, sub: r.integrator?.name, details: r.notes })),
    ...(commRows || []).map(r => ({ type: 'communication', date: r.sent_at, title: `Message ${r.channel}`, sub: r.direction, details: r.content })),
    ...(needRows || []).map(r => ({ type: 'need', date: r.detected_at, title: 'Besoin détecté', sub: r.detected_by?.name, details: r.note, category: r.category })),
    ...(attendanceRows || []).map(r => ({ type: 'attendance', date: r.date, title: r.present ? 'Présent à la FIJ' : 'Absent à la FIJ', sub: null, details: r.notes })),
  ].filter(e => e.date).sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <AppLayout profile={profile} pageId="visiteurs" title={`${contact.first_name} ${contact.last_name}`}>
      <ContactProfileClient
        contact={contact}
        integratorPair={integratorPair || []}
        timeline={timeline}
        needs={needRows || []}
        communications={commRows || []}
        reports={reportRows || []}
        profile={profile}
      />
    </AppLayout>
  )
}
