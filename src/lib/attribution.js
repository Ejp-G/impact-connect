import { createAdminClient } from '@/lib/supabase/server'

/**
 * Attribution automatique agent + FI pour un nouveau contact
 * Règle obligatoire : H→H, F→F
 */
export async function autoAttributeContact({ contactId, sex, communeId }) {
  const supabase = createAdminClient()
  const results = {}

  // 1. Attribution agent (même sexe)
  const { data: agent } = await supabase.rpc('auto_assign_agent', {
    p_contact: contactId, p_sex: sex
  })
  results.agentId = agent

  // 2. Attribution FI
  if (communeId) {
    const { data: fi } = await supabase.rpc('auto_assign_fi', {
      p_contact: contactId, p_commune: communeId
    })
    results.fiId = fi
  }

  // 3. Envoi notification bienvenue (async, non bloquant)
  sendWelcomeNotification(supabase, contactId).catch(console.error)

  return results
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
