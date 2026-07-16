import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { matchHeaderToField, isNoiseRow } from './fieldDictionary';
import { CONFIDENCE_THRESHOLD } from './config';
import { mapAmbiguousHeaders } from './claudeClient';

// Lit un fichier Excel (buffer) et retourne un tableau de lignes brutes (array of arrays)
export function readExcelRows(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
}

// Lit un fichier CSV (texte) et retourne un tableau de lignes brutes
export function readCsvRows(text) {
  const result = Papa.parse(text, { skipEmptyLines: false });
  return result.data;
}

// Trouve la ligne d'en-tête la plus probable parmi les N premières lignes
// (les fichiers EJP ont souvent une bannière/logo avant les vrais en-têtes)
function detectHeaderRowIndex(rows, maxScan = 10) {
  let best = { index: 0, matchCount: -1 };

  for (let i = 0; i < Math.min(maxScan, rows.length); i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const matchCount = row.filter((cell) => matchHeaderToField(cell).score >= 0.75).length;
    if (matchCount > best.matchCount) {
      best = { index: i, matchCount };
    }
  }
  return best.index;
}

// Construit le mapping colonne -> champ canonique pour un ensemble d'en-têtes,
// avec fallback Claude pour les en-têtes non reconnus avec confiance suffisante
export async function buildColumnMapping(headers, sampleRows) {
  const mapping = {}; // { columnIndex: { field, confidence, usedClaude } }
  const ambiguousIndexes = [];
  const ambiguousHeaders = [];

  headers.forEach((header, index) => {
    const { field, score } = matchHeaderToField(header);
    if (field && score >= CONFIDENCE_THRESHOLD) {
      mapping[index] = { field, confidence: score, usedClaude: false };
    } else {
      ambiguousIndexes.push(index);
      ambiguousHeaders.push(header || `(colonne ${index + 1})`);
    }
  });

  if (ambiguousHeaders.length > 0) {
    try {
      const claudeMapping = await mapAmbiguousHeaders(ambiguousHeaders, sampleRows);
      ambiguousIndexes.forEach((index, i) => {
        const header = ambiguousHeaders[i];
        const field = claudeMapping[header];
        if (field && field !== 'ignorer') {
          mapping[index] = { field, confidence: 0.5, usedClaude: true };
        }
      });
    } catch (err) {
      console.error('Claude fallback mapping failed:', err.message);
      // On continue sans ces colonnes — elles resteront non mappées,
      // signalées à l'utilisateur en aperçu.
    }
  }

  return mapping;
}

// Pipeline complet: rows bruts -> { headerRow, dataRows, columnMapping }
export async function parseAndMapRows(rows) {
  const headerRowIndex = detectHeaderRowIndex(rows);
  const headers = rows[headerRowIndex] || [];
  const dataRows = rows.slice(headerRowIndex + 1).filter((r) => r && r.length > 0 && !isNoiseRow(r));

  const sampleRows = dataRows.slice(0, 3);
  const columnMapping = await buildColumnMapping(headers, sampleRows);

  const mappedRecords = dataRows.map((row) => {
    const record = {};
    Object.entries(columnMapping).forEach(([colIndex, { field }]) => {
      const value = row[Number(colIndex)];
      if (value !== undefined && String(value).trim() !== '') {
        record[field] = String(value).trim();
      }
    });
    return record;
  });

  return { headers, columnMapping, rawDataRows: dataRows, mappedRecords };
}
