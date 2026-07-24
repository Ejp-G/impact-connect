import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function emailWrapper(title, bodyHtml) {
  return `
    <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E293B;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display:inline-block;background:#0B3D91;color:#fff;font-size:18px;font-weight:800;padding:10px 20px;border-radius:12px;">EJP Guadeloupe</div>
      </div>
      <p style="font-size:16px;font-weight:700;margin-bottom:12px;">${title}</p>
      ${bodyHtml}
      <div style="border-top:1px solid #E2E8F0;padding-top:16px;margin-top:24px;text-align:center;color:#94A3B8;font-size:12px;">Impact Connect — EJP Guadeloupe</div>
    </div>
  `
}

async function sendTo(email, subject, html) {
  if (!email) return
  try {
    await resend.emails.send({ from: 'EJP Guadeloupe <onboarding@resend.dev>', to: email, subject, html })
  } catch (err) {
    console.error('Erreur envoi fi-pilot-alerts:', err)
  }
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()
  const stats = { contactReminders: 0, absenceAlerts: 0, whatsappReminders: 0 }

  // ---------- 1. Relance 48h sans 1er contact ----------
  const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
  const { data: uncontacted } = await supabase
    .from('contacts')
    .select(`
      id, first_name, last_name, phone, assignment_date,
      fi:familles_impact(name, pilot:profiles!familles_impact_pilot_id_fkey(name,email), copilot:profiles!familles_impact_copilot_id_fkey(name,email))
    `)
    .eq('fi_contacted', false)
    .eq('fi_contact_reminder_sent', false)
    .not('fi_id', 'is', null)
    .lte('assignment_date', cutoff)

  for (const c of uncontacted || []) {
    const recipients = [c.fi?.pilot, c.fi?.copilot].filter(p => p?.email)
    for (const r of recipients) {
      await sendTo(r.email, `⏰ Relance : ${c.first_name} n'a pas encore été contacté(e)`, emailWrapper(
        `Salut ${(r.name || '').split(' ')[0]},`,
        `<p style="font-size:15px;line-height:1.7;"><strong>${c.first_name} ${c.last_name}</strong> a été rattaché(e) à ta FIJ <strong>${c.fi?.name}</strong> il y a plus de 48h, et le premier contact n'a pas encore été confirmé dans Impact Connect.</p>
         <p style="font-size:15px;line-height:1.7;">${c.phone ? `📞 ${c.phone}<br/>` : ''}Pense à le/la contacter dès que possible, puis à confirmer dans l'appli.</p>`
      ))
    }
    await supabase.from('contacts').update({ fi_contact_reminder_sent: true }).eq('id', c.id)
    stats.contactReminders++
  }

  // ---------- 2. Escalade absences consécutives ----------
  const { data: attendance } = await supabase
    .from('fi_attendance')
    .select('contact_id, date, present')
    .order('date', { ascending: false })

  const byContact = {}
  ;(attendance || []).forEach(r => {
    if (!byContact[r.contact_id]) byContact[r.contact_id] = []
    byContact[r.contact_id].push(r)
  })

  const { data: responsables } = await supabase.from('profiles').select('email,name').eq('role', 'responsable_integration').eq('active', true)

  for (const [contactId, rows] of Object.entries(byContact)) {
    let streak = 0
    for (const row of rows) {
      if (row.present === false) streak++
      else break
    }

    const { data: contact } = await supabase
      .from('contacts')
      .select(`
        id, first_name, last_name, fi_absence_alert_weeks,
        fi:familles_impact(name, pilot:profiles!familles_impact_pilot_id_fkey(name,email), copilot:profiles!familles_impact_copilot_id_fkey(name,email))
      `)
      .eq('id', contactId).single()
    if (!contact) continue

    if (streak === 0) {
      if (contact.fi_absence_alert_weeks > 0) {
        await supabase.from('contacts').update({ fi_absence_alert_weeks: 0 }).eq('id', contactId)
      }
      continue
    }

    if (streak <= contact.fi_absence_alert_weeks) continue // déjà notifié pour ce niveau

    const pilotsRecipients = [contact.fi?.pilot, contact.fi?.copilot].filter(p => p?.email)
    let subject, message, extraRecipients = []

    if (streak === 1) {
      subject = `${contact.first_name} était absent(e) ce jeudi`
      message = `<p style="font-size:15px;line-height:1.7;"><strong>${contact.first_name} ${contact.last_name}</strong> était absent(e) à la dernière séance de <strong>${contact.fi?.name}</strong>. Une prise de nouvelles est conseillée.</p>`
    } else if (streak === 2) {
      subject = `⚠️ ${contact.first_name} absent(e) 2 semaines de suite`
      message = `<p style="font-size:15px;line-height:1.7;"><strong>${contact.first_name} ${contact.last_name}</strong> est absent(e) depuis 2 séances consécutives de <strong>${contact.fi?.name}</strong>. Une relance renforcée est nécessaire.</p>`
    } else if (streak === 3) {
      subject = `🚨 ${contact.first_name} absent(e) 3 semaines de suite`
      message = `<p style="font-size:15px;line-height:1.7;"><strong>${contact.first_name} ${contact.last_name}</strong> est absent(e) depuis 3 séances consécutives de <strong>${contact.fi?.name}</strong>. Le responsable intégration est notifié.</p>`
      extraRecipients = responsables || []
    } else {
      subject = `🚨 URGENT : ${contact.first_name} absent(e) ${streak} semaines de suite`
      message = `<p style="font-size:15px;line-height:1.7;"><strong>${contact.first_name} ${contact.last_name}</strong> est absent(e) depuis ${streak} séances consécutives de <strong>${contact.fi?.name}</strong>. Une action rapide est nécessaire (appel, visite, accompagnement).</p>`
      extraRecipients = responsables || []
    }

    const allRecipients = [...pilotsRecipients, ...extraRecipients].filter(p => p?.email)
    for (const r of allRecipients) {
      await sendTo(r.email, subject, emailWrapper(`Salut ${(r.name || '').split(' ')[0]},`, message))
    }
    await supabase.from('contacts').update({ fi_absence_alert_weeks: streak }).eq('id', contactId)
    stats.absenceAlerts++
  }

  // ---------- 3. Intégration WhatsApp après 3 séances ----------
  const presentCounts = {}
  ;(attendance || []).forEach(r => {
    if (r.present) presentCounts[r.contact_id] = (presentCounts[r.contact_id] || 0) + 1
  })

  const eligibleIds = Object.entries(presentCounts).filter(([, count]) => count >= 3).map(([id]) => id)
  if (eligibleIds.length) {
    const { data: eligibleContacts } = await supabase
      .from('contacts')
      .select(`
        id, first_name, last_name, fi_whatsapp_added, fi_whatsapp_reminder_sent,
        fi:familles_impact(name, pilot:profiles!familles_impact_pilot_id_fkey(name,email), copilot:profiles!familles_impact_copilot_id_fkey(name,email))
      `)
      .in('id', eligibleIds)
      .eq('fi_whatsapp_added', false)
      .eq('fi_whatsapp_reminder_sent', false)

    for (const c of eligibleContacts || []) {
      const recipients = [c.fi?.pilot, c.fi?.copilot].filter(p => p?.email)
      for (const r of recipients) {
        await sendTo(r.email, `🎉 ${c.first_name} a participé à 3 FIJ`, emailWrapper(
          `Salut ${(r.name || '').split(' ')[0]},`,
          `<p style="font-size:15px;line-height:1.7;"><strong>${c.first_name} ${c.last_name}</strong> vient de participer à sa 3ᵉ séance de <strong>${c.fi?.name}</strong>. Pense à l'ajouter au groupe WhatsApp de la FIJ, puis à confirmer dans Impact Connect.</p>`
        ))
      }
      await supabase.from('contacts').update({ fi_whatsapp_reminder_sent: true }).eq('id', c.id)
      stats.whatsappReminders++
    }
  }

  return NextResponse.json({ success: true, ...stats })
}
