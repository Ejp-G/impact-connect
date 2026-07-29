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
          parentLastName, parentFirstName, parentPhone, parentEmail,
          contactPreference, availability, invitedBy, welcomedByName, prayerCategories } = body

  if (!firstName?.trim() || !lastName?.trim() || !sex) {
    return NextResponse.json({ error: 'Prénom, nom et sexe sont obligatoires' }, { status: 400 })
  }

  if (!welcomedByName?.trim()) {
    return NextResponse.json({ error: 'Merci d\'indiquer qui vous a accueilli aujourd\'hui.' }, { status: 400 })
  }

  const emailValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  if (!emailValid) {
    return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 })
  }

  const isMinor = dateOfBirth
    ? new Date(dateOfBirth) > new Date(new Date().setFullYear(new Date().getFullYear() - 18))
    : false

  if (isMinor && (!parentLastName?.trim() || !parentPhone?.trim())) {
    return NextResponse.json({ error: 'Informations du parent obligatoires pour les mineurs' }, { status: 400 })
  }

  // Deduit du choix de preference de contact : si la personne demande a
  // ne pas etre contactee, on ne peut pas la marquer "souhaite etre
  // contactee" en meme temps (contradiction evitee).
  const wantsContact = contactPreference !== 'none'

  const contactData = {
    first_name: firstName.trim(), last_name: lastName.trim(), sex,
    date_of_birth: dateOfBirth || null,
    phone: phone || null, whatsapp: whatsapp || null, email: email || null,
    commune: commune || null, commune_id: communeId || null, quartier: quartier || null,
    address: address?.trim() || null,
    first_visit: firstVisit, salvation_call: salvationCall,
    wants_contact: wantsContact, wants_fi: wantsFI,
    prayer_request: prayerRequest || null, how_found: howFound || null,
    parental_status: isMinor ? 'pending' : 'not_required',
    parent_last_name: parentLastName || null, parent_first_name: parentFirstName || null,
    parent_phone: parentPhone || null, parent_email: parentEmail || null,
    contact_preference: contactPreference || null,
    availability: availability?.length ? availability : null,
    invited_by: invitedBy?.trim() || "Je suis venu(e) seul(e).",
    welcomed_by_name: welcomedByName.trim(),
    prayer_categories: prayerCategories?.length ? prayerCategories : null,
  }

  const { data: contact, error } = await supabase.from('contacts').insert(contactData).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (email) {
    sendWelcomeEmail(firstName, email).catch(console.error)
  }

  if (!isMinor && wantsFI) {
    autoAttributeContact({
      contactId: contact.id, sex, communeId: communeId || null, quartier: quartier || null
    }).catch(console.error)
  }

  const { data: admins } = await supabase.from('profiles')
    .select('id').in('role', ['admin', 'responsable_integration'])
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
