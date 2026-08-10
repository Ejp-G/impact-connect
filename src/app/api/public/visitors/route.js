import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { autoAttributeContact } from '@/lib/attribution'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

async function sendWelcomeEmail(firstName, email) {
  if (!email) return
  try {
    await resend.emails.send({
      from: 'EJP Guadeloupe <onboarding@resend.dev>',
      to: email,
      subject: 'Bienvenue parmi nous 🙏',
      html: `
        <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1E293B;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; background: #0B3D91; color: white; font-size: 20px; font-weight: 800; padding: 10px 20px; border-radius: 12px; letter-spacing: 1px;">
              EJP Guadeloupe
            </div>
          </div>
          <p style="font-size: 16px; line-height: 1.7; margin-bottom: 16px;">Coucou <strong>${firstName}</strong>,</p>
          <p style="font-size: 16px; line-height: 1.7; margin-bottom: 16px;">
            Merci d'avoir été parmi nous aujourd'hui. Ça nous a fait vraiment plaisir de te rencontrer.
          </p>
          <p style="font-size: 16px; line-height: 1.7; margin-bottom: 16px;">
            Nous espérons que tu as passé un bon moment. Si tu as la moindre question ou simplement envie d'échanger, nous sommes là.
          </p>
          <p style="font-size: 16px; line-height: 1.7; margin-bottom: 32px;">
            Prends soin de toi, et à très bientôt.
          </p>
          <div style="border-top: 1px solid #E2E8F0; padding-top: 20px; text-align: center; color: #94A3B8; font-size: 13px;">
            Église Jeunes Prodiges Guadeloupe — Impact Connect
          </div>
        </div>
      `,
    })
  } catch (err) {
    console.error('Erreur email bienvenue:', err)
  }
}

// Rattache la fiche finalisée au parcours dont elle est issue (s'il y en
// a un). Le contact continue d'être créé exactement comme avant ; cette
// étape n'ajoute qu'un lien de traçabilité, elle ne modifie rien au flux
// existant (Visiteurs, Suivi & Tâches, attribution automatique...).
async function finalizeParcours(supabase, parcoursToken, contactId) {
  if (!parcoursToken) return
  const { data: parcours } = await supabase
    .from('parcours_integration')
    .select('id, contact_id')
    .eq('token', parcoursToken)
    .single()
  if (!parcours || parcours.contact_id) return

  await supabase.from('parcours_integration').update({
    status: 'finalise',
    contact_id: contactId,
    finalized_at: new Date().toISOString(),
  }).eq('id', parcours.id)

  await supabase.from('audit_log').insert({
    action: 'Fiche finalisée depuis le parcours',
    entity_type: 'parcours',
    entity_id: parcours.id,
    details: { contact_id: contactId }
  })
}

// Route publique dediee au formulaire QR (accessible sans connexion,
// contrairement a /api/visitors reservee au formulaire interne
// "+Nouveau visiteur" qui exige une session). Utilise createAdminClient
// pour ecrire malgre l'absence de session, la validation des champs
// obligatoires ci-dessous fait office de garde-fou.
export async function POST(request) {
  const supabase = createAdminClient()
  const body = await request.json()
  const { firstName, lastName, sex, dateOfBirth, phone, whatsapp, email,
          commune, communeId, quartier, address, firstVisit, salvationCall,
          wantsFI, prayerRequest, howFound,
          parentLastName, parentFirstName, parentPhone, parentEmail, parentAddress,
          contactPreference, availability, invitedBy, welcomedBy, welcomedByName,
          prayerCategories, parcoursToken } = body

  const isMinor = dateOfBirth
    ? new Date(dateOfBirth) > new Date(new Date().setFullYear(new Date().getFullYear() - 18))
    : false

  if (!firstName?.trim() || !sex || (!isMinor && !lastName?.trim())) {
    return NextResponse.json({ error: 'Prénom et sexe sont obligatoires (nom obligatoire pour un majeur)' }, { status: 400 })
  }

  if (!dateOfBirth) {
    return NextResponse.json({ error: 'La date de naissance est obligatoire.' }, { status: 400 })
  }

  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "L'adresse email est obligatoire et doit être valide." }, { status: 400 })
  }

  if (!address?.trim()) {
    return NextResponse.json({ error: "L'adresse est obligatoire." }, { status: 400 })
  }

  if (!commune?.trim()) {
    return NextResponse.json({ error: 'La commune est obligatoire.' }, { status: 400 })
  }

  if (!welcomedByName?.trim()) {
    return NextResponse.json({ error: 'Merci d\'indiquer qui vous a accueilli aujourd\'hui.' }, { status: 400 })
  }

  if (isMinor && (!parentLastName?.trim() || !parentPhone?.trim())) {
    return NextResponse.json({ error: 'Informations du parent obligatoires pour les mineurs' }, { status: 400 })
  }

  const wantsContact = contactPreference !== 'none'

  const contactData = {
    first_name: firstName.trim(), last_name: lastName?.trim() || null, sex,
    date_of_birth: dateOfBirth || null,
    phone: phone || null, whatsapp: whatsapp || null, email: email || null,
    commune: commune || null, commune_id: communeId || null, quartier: quartier || null,
    address: address?.trim() || null,
    first_visit_date: new Date().toISOString().slice(0, 10),
    first_visit: firstVisit, salvation_call: salvationCall,
    wants_contact: wantsContact, wants_fi: wantsFI,
    prayer_request: prayerRequest || null, how_found: howFound || null,
    parental_status: isMinor ? 'pending' : 'not_required',
    parent_last_name: parentLastName || null, parent_first_name: parentFirstName || null,
    parent_phone: parentPhone || null, parent_email: parentEmail || null,
    parent_address: parentAddress || null,
    contact_preference: contactPreference || null,
    availability: availability?.length ? availability : null,
    invited_by: invitedBy?.trim() || "Je suis venu(e) seul(e).",
    welcomed_by: welcomedBy || null,
    welcomed_by_name: welcomedByName.trim(),
    prayer_categories: prayerCategories?.length ? prayerCategories : null,
  }

  const { data: contact, error } = await supabase.from('contacts').insert(contactData).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await finalizeParcours(supabase, parcoursToken, contact.id)

  if (email) {
    sendWelcomeEmail(firstName, email).catch(console.error)
  }

  // Respect strict de "je prefere ne pas etre contacte(e)" : aucune
  // attribution automatique (binome d'integrateurs ET FIJ + notification
  // pilote) n'est declenchee pour ces personnes. Elles restent
  // enregistrees, visibles et comptabilisees, mais personne n'est charge
  // de les contacter tant qu'un administrateur ne change pas ce choix
  // manuellement depuis leur fiche.
  if (!isMinor && wantsFI && contactPreference !== 'none') {
    autoAttributeContact({
      contactId: contact.id, sex, communeId: communeId || null, quartier: quartier || null
    }).catch(console.error)
  }

  const { data: admins } = await supabase.from('profiles')
    .select('id').in('role', ['admin', 'responsable_suivi'])
  if (admins?.length) {
    await supabase.from('notifications').insert(
      admins.map(a => ({
        user_id: a.id, type: 'new_contact',
        title: 'Nouveau visiteur',
        message: `${firstName} ${lastName} vient de s'inscrire (${commune || 'commune non renseignée'})`,
      }))
    )
  }

  return NextResponse.json({ data: contact }, { status: 201 })
}
