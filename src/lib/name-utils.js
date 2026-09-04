// lib/name-utils.js
//
// Les profils sont enregistrés au format "NOM Prénom" (ex: "ZELATEUR
// Marie-Alexia"), pas "Prénom NOM". Donc extraire le prénom pour une
// formule de politesse ("Bonjour {prénom}") doit prendre le DERNIER
// mot, pas le premier — l'inverse de l'intuition habituelle.
//
// Limite connue : quelques profils saisis dans l'autre sens (ex:
// "Coraline ABATUCI - CALIXTE") donneront un résultat inversé. Cette
// fonction ne peut pas deviner la convention utilisée pour un profil
// donné — c'est un compromis qui corrige la grande majorité des cas
// (format "NOM Prénom" dominant) plutôt qu'une solution parfaite.
export function firstNameOf(fullName) {
  if (!fullName) return ''
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return parts[0] || ''
  return parts[parts.length - 1]
}
