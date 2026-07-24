import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Convertit un numéro local en format international pour un lien wa.me
 * Hypothèse : numéros saisis au format local (ex: 0690 12 34 56) -> +590
 * À ajuster si vos numéros sont déjà saisis avec l'indicatif.
 */
function toWhatsappNumber(raw) {
  if (!raw) return null
  let digits = raw.replace(/[^\d]/g, '')
  if (digits.startsWith('590')) return digits
  if (digits.startsWith('0')) return '590' + digits.slice(1)
  return digits.length <= 10 ? '590' + digits : digits
}

/**
 * Attribution automatique agent + FI pour un nouveau contact
 * Règle obligatoire : H→H, F→F
 */
export async function autoAttributeContact({ contactId, sex, communeId, quartier }) {
  const supabase = createAdminClient()
  const results = {}

  // 1. Attribution agent (même sexe)
  const { data: agent } = await supabase.rpc('auto_assign_agent', {
    p_contact: contactId, p_sex: sex
  })
  results.agentId = agent

  // 2. Attribution FI (quartier précis -> commune -> repli global)
  if (communeId) {
    const { data: fiId } = await supabase.rpc('auto_assign_fi', {
      p_contact: contactId, p_commune: communeId, p_quartier: quartier || null
    })
    results.fiId = fiId
    if (fiId) {
      notifyFiPilot(supabase, fiId, contactId).catch(console.error)
    }
  }

  // 3. Envoi notification bienvenue (async, non bloquant)
  sendWelcomeNotification(supabase, contactId).catch(console.error)

  return results
}

async function notifyFiPilot(supabase, fiId, contactId) {
  const { data: fi } = await supabase.from('familles_impact')
    .select(`
      name,
      pilot:profiles!familles_impact_pilot_id_fkey(name,email,phone),
      copilot:profiles!familles_impact_copilot_id_fkey(name,email,phone)
    `)
    .eq('id', fiId).single()
  if (!fi) return

  const { data: contact } = await supabase.from('contacts')
    .select('first_name,last_name,phone,whatsapp,email,commune,date_of_birth,first_visit_date,prayer_request')
    .eq('id', contactId).single()
  if (!contact) return

  const age = contact.date_of_birth
    ? Math.floor((Date.now() - new Date(contact.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null

  const waNumber = toWhatsappNumber(contact.whatsapp || contact.phone)
  const waMessage = encodeURIComponent(
    `Bonjour ${contact.first_name} ! Je suis ton contact pour la FIJ ${fi.name} à EJP Guadeloupe. On se voit jeudi ? 😊`
  )
  const waLink = waNumber ? `https://wa.me/${waNumber}?text=${waMessage}` : null

  const recipients = [fi.pilot, fi.copilot].filter(p => p?.email)
  if (!recipients.length) return

  for (const person of recipients) {
    try {
      await resend.emails.send({
        from: 'EJP Guadeloupe <onboarding@resend.dev>',
        to: person.email,
        subject: `Nouveau dans ta FIJ : ${contact.first_name} ${contact.last_name}`,
        html: `
          <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E293B;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display:inline-block;background:#0B3D91;color:#fff;font-size:18px;font-weight:800;padding:10px 20px;border-radius:12px;">EJP Guadeloupe</div>
            </div>
            <p style="font-size:16px;">Salut ${(person.name || '').split(' ')[0]},</p>
            <p style="font-size:16px;line-height:1.7;">Une nouvelle personne vient d'être rattachée à ta FIJ <strong>${fi.name}</strong> :</p>
            <div style="background:#F8FAFC;border-radius:12px;padding:16px 20px;margin:20px 0;font-size:14px;line-height:1.9;">
              <div><strong>${contact.first_name} ${contact.last_name}</strong></div>
              ${contact.phone ? `<div>📞 ${contact.phone}</div>` : ''}
              ${contact.email ? `<div>✉️ ${contact.email}</div>` : ''}
              ${contact.commune ? `<div>📍 ${contact.commune}</div>` : ''}
              ${age !== null ? `<div>🎂 ${age} ans</div>` : ''}
              ${contact.first_visit_date ? `<div>🗓️ Arrivé(e) le ${contact.first_visit_date}</div>` : ''}
              ${contact.prayer_request ? `<div>🙏 ${contact.prayer_request}</div>` : ''}
            </div>
            <p style="font-size:15px;line-height:1.7;">Pense à le/la contacter avant jeudi pour l'inviter à la prochaine FIJ, et à confirmer le contact dans Impact Connect.</p>
            ${waLink ? `<div style="text-align:center;margin:28px 0;"><a href="${waLink}" style="background:#25D366;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">Contacter sur WhatsApp</a></div>` : ''}
            <div style="border-top:1px solid #E2E8F0;padding-top:16px;text-align:center;color:#94A3B8;font-size:12px;">Impact Connect — EJP Guadeloupe</div>
          </div>
        `
      })
    } catch (err) {
      console.error('Erreur email pilote FIJ:', err)
    }
  }

  await supabase.from('communication_logs').insert({
    contact_id: contactId,
    channel: 'email',
    content: `Notification d'attribution envoyée au pilote/co-pilote de la FIJ ${fi.name}`,
    status: 'sent'
  })
}

async function sendWelcomeNotification(supabase, contactId) {
  const { data: contact } = await supabase
    .from('contacts')
    .select('first_name, last_name, whatsapp, email, assigned_to')
    .eq('id', contactId)
    .single()
  if (!contact) return
  // Log communication
  await supabase.from('communication_logs').insert({
    contact_id: contactId,
    channel: 'whatsapp',
    content: `Message de bienvenue envoyé à ${contact.first_name} ${contact.last_name}`,
    status: 'sent'
  })
}
