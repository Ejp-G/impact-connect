// Règles de validation pour chaque transition du Pipeline d'intégration.
// Chaque règle reçoit le contact (avec ses champs de suivi) + les agrégats calculés
// (nombre de présences FIJ effectives) et retourne { ok, reason }.

export const STAGE_RULES = {
  contacte: (contact) =>
    contact.last_contact_at
      ? { ok: true }
      : { ok: false, reason: "Aucun contact enregistré avec cette personne." },

  invite_fi: (contact) =>
    contact.fi_id && contact.fi_contacted
      ? { ok: true }
      : { ok: false, reason: "FIJ non attribuée ou 1er contact FIJ non confirmé." },

  fi1: (contact, agg) =>
    agg.presentCount >= 1
      ? { ok: true }
      : { ok: false, reason: "Aucune présence enregistrée en FIJ." },

  fi2: (contact, agg) =>
    agg.presentCount >= 2
      ? { ok: true }
      : { ok: false, reason: "Moins de 2 présences enregistrées en FIJ." },

  integre: (contact, agg) =>
    agg.presentCount >= 3 && contact.fi_whatsapp_added
      ? { ok: true }
      : { ok: false, reason: "Moins de 3 présences en FIJ, ou pas encore ajouté(e) au groupe WhatsApp." },

  bapteme: (contact) =>
    contact.baptism_date
      ? { ok: true }
      : { ok: false, reason: "Date de baptême non renseignée." },
}

export function checkStageTransition(contact, agg, newStage) {
  const rule = STAGE_RULES[newStage]
  if (!rule) return { ok: true } // pas de règle définie pour cette étape -> toujours autorisé
  return rule(contact, agg)
}
