import { CANONICAL_FIELDS, ANTHROPIC_MODEL } from './config';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

function anthropicHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
  };
}

function extractJson(text) {
  // Retire d'éventuels ```json ... ``` autour de la réponse
  const cleaned = text.replace(/```json\s*|```/g, '').trim();
  return JSON.parse(cleaned);
}

// --- Fallback: mapping d'en-têtes ambigus ---
// headers: string[] (en-têtes non résolus par l'heuristique)
// sampleRows: array de quelques lignes brutes (pour donner du contexte)
export async function mapAmbiguousHeaders(headers, sampleRows) {
  const prompt = `Tu aides à importer des fiches visiteurs pour une église (Guadeloupe).
Voici des en-têtes de colonnes non reconnus automatiquement, et quelques lignes d'exemple.
Associe chaque en-tête à UN SEUL champ canonique parmi cette liste, ou à "ignorer" si aucun ne correspond :
${CANONICAL_FIELDS.join(', ')}, ignorer

En-têtes: ${JSON.stringify(headers)}
Lignes d'exemple: ${JSON.stringify(sampleRows).slice(0, 3000)}

Réponds UNIQUEMENT avec un objet JSON de la forme { "en-tête": "champ_canonique_ou_ignorer", ... }. Pas de texte autour.`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: anthropicHeaders(),
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error (mapping): ${response.status}`);
  }

  const data = await response.json();
  const textBlock = data.content.find((b) => b.type === 'text');
  return extractJson(textBlock?.text || '{}');
}

// --- Extraction native depuis un PDF (texte ou scanné) ---
// base64Pdf: contenu du PDF encodé en base64 (sans préfixe data:)
export async function extractRecordsFromPdf(base64Pdf) {
  const prompt = `Ce document est un tableau de suivi de visiteurs/jeunes reçus dans une église en Guadeloupe.
Extrais CHAQUE ligne de données comme un enregistrement JSON avec ces champs (laisse vide "" si absent) :
${CANONICAL_FIELDS.join(', ')}

Ignore les lignes de titre/séparateur de section (ex: "Jeunes reçus le dimanche ... à recontacter").
Réponds UNIQUEMENT avec un tableau JSON d'objets, sans texte autour, sans balises markdown.`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: anthropicHeaders(),
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Pdf,
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error (PDF extraction): ${response.status}`);
  }

  const data = await response.json();
  const textBlock = data.content.find((b) => b.type === 'text');
  return extractJson(textBlock?.text || '[]');
}
