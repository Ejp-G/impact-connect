// ============================================================
// EMAILS D'ANNIVERSAIRE — version corrigée
// Remplace : src/app/api/cron/birthday/route.js
//
// Corrections par rapport à la version précédente :
//  1. Date du jour calculée explicitement en heure de la Guadeloupe
//  2. Détection réelle des échecs Resend ({ error } n'est pas une exception)
//  3. Respect de « Ne pas contacter » et stop_relances
//  4. Mineurs : envoi uniquement si autorisation parentale obtenue,
//     en priorité au représentant légal
//  5. Trace de chaque envoi dans communication_logs (visible sur la fiche)
//  6. Idempotence : pas de double envoi si le cron est rejoué
//  7. Expéditeur configurable via RESEND_FROM (une fois le domaine
//     vérifié dans Resend) — fallback sur l'adresse de test sinon
// ============================================================

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// ⚠️ onboarding@resend.dev n'autorise l'envoi qu'au propriétaire du
// compte Resend. Pour de vrais envois : vérifier un domaine dans Resend
// puis définir RESEND_FROM dans Vercel, ex. "EJP Guadeloupe <contact@ejp-guadeloupe.com>"
const FROM = process.env.RESEND_FROM || 'EJP Guadeloupe <onboarding@resend.dev>'

const AUTHORIZED_VALUES = ['autorise', 'authorized', 'approved', 'valide']

function birthdayHtml(firstName, forParent) {
  const intro = forParent
    ? `<p style="font-size: 16px; line-height: 1.7; margin-bottom: 16px;">Aujourd'hui, c'est l'anniversaire de <strong>${firstName}</strong> ! 🎂</p>
       <p style="font-size: 16px; line-height: 1.7; margin-bottom: 16px;">Toute la famille EJP se joint à vous pour lui souhaiter une très belle journée.</p>`
    : `<p style="font-size: 16px; line-height: 1.7; margin-bottom: 16px;">Joyeux anniversaire <strong>${firstName}</strong> ! 🎂</p>
       <p style="font-size: 16px; line-height: 1.7; margin-bottom: 16px;">On voulait simplement te souhaiter une très belle journée.</p>`
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E293B;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; background: #0B3D91; color: white; font-size: 20px; font-weight: 800; padding: 10px 20px; border-radius: 12px; letter-spacing: 1px;">
          EJP Guadeloupe
        </div>
      </div>
      ${intro}
      <p style="font-size: 16px; line-height: 1.7; margin-bottom: 16px;">
        Que cette nouvelle année soit remplie de paix, de joie et de belles surprises. Que Dieu ${forParent ? 'le/la' : 'te'} garde et ${forParent ? 'le/la' : 'te'} bénisse dans tout ce qu'${forParent ? 'il/elle' : 'tu'} entreprend${forParent ? '' : 's'}.
      </p>
      <p style="font-size: 16px; line-height: 1.7; margin-bottom: 32px;">
        ${forParent ? 'Belle journée à toute la famille !' : 'Profite bien de ta journée !'} 🙏
      </p>
      <div style="border-top: 1px solid #E2E8F0; padding-top: 20px; text-align: center; color: #94A3B8; font-size: 13px;">
        Église Jeunes Prodiges Guadeloupe — Impact Connect
      </div>
    </div>
  `
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Date du jour en heure de la Guadeloupe (UTC-4, sans heure d'été),
  // quel que soit le fuseau du serveur ou l'horaire du cron.
  const todayGp = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Guadeloupe', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date()) // "YYYY-MM-DD"
  const [, month, day] = todayGp.split('-')

  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, date_of_birth, is_minor, parental_status, parent_email, contact_preference, stop_relances')
    .eq('status', 'active')
    .not('date_of_birth', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Comparaison jour/mois sur la chaîne YYYY-MM-DD, sans new Date(),
  // pour éliminer tout risque de décalage de fuseau.
  const birthdays = (contacts || []).filter(c => {
    const [, bMonth, bDay] = String(c.date_of_birth).slice(0, 10).split('-')
    return bMonth === month && bDay === day
  })

  const results = { date: todayGp, sent: [], skipped: [], errors: [] }

  for (const c of birthdays) {
    const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim()

    // Respect des préférences de contact
    if (c.contact_preference === 'none' || c.stop_relances) {
      results.skipped.push({ name: fullName, reason: 'ne pas contacter' })
      continue
    }

    // Mineurs : uniquement avec autorisation parentale,
    // et en priorité vers le représentant légal
    let recipient = c.email || null
    let forParent = false
    if (c.is_minor) {
      const authorized = AUTHORIZED_VALUES.includes((c.parental_status || '').toLowerCase())
      if (!authorized) {
        results.skipped.push({ name: fullName, reason: 'mineur sans autorisation parentale' })
        continue
      }
      if (c.parent_email) {
        recipient = c.parent_email
        forParent = true
      }
    }

    if (!recipient) {
      results.skipped.push({ name: fullName, reason: 'aucun email renseigné' })
      continue
    }

    // Idempotence : ne pas renvoyer si déjà envoyé aujourd'hui
    const { data: alreadySent } = await supabase
      .from('communication_logs')
      .select('id')
      .eq('contact_id', c.id)
      .eq('channel', 'email')
      .ilike('content', '%anniversaire automatique%')
      .gte('sent_at', `${todayGp}T00:00:00-04:00`)
      .limit(1)
    if (alreadySent && alreadySent.length > 0) {
      results.skipped.push({ name: fullName, reason: 'déjà envoyé aujourd\'hui' })
      continue
    }

    // Envoi — le SDK Resend ne lève pas d'exception en cas de rejet :
    // il faut vérifier le champ error de la réponse.
    const { error: sendError } = await resend.emails.send({
      from: FROM,
      to: recipient,
      subject: forParent
        ? `🎂 C'est l'anniversaire de ${c.first_name} !`
        : `Joyeux anniversaire ${c.first_name} ! 🎂`,
      html: birthdayHtml(c.first_name || '', forParent),
    })

    if (sendError) {
      results.errors.push({ name: fullName, to: recipient, error: sendError.message || String(sendError) })
      continue
    }

    // Trace visible dans l'onglet Communications de la fiche
    await supabase.from('communication_logs').insert({
      contact_id: c.id,
      channel: 'email',
      direction: 'outbound',
      content: forParent
        ? `Email d'anniversaire automatique envoyé au représentant légal (${recipient})`
        : `Email d'anniversaire automatique envoyé (${recipient})`,
      sent_by: null,
      sent_at: new Date().toISOString(),
      status: 'sent',
    })

    results.sent.push({ name: fullName, to: recipient })
  }

  return NextResponse.json({ success: true, ...results })
}
