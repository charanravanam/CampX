import { SubjectInfo } from '../types';

export interface OCRExtractedSubject {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  extractedPercentage: number;
  extractedAttended: number;
  extractedTotal: number;
  confidence: 'high' | 'medium' | 'low';
  matchedBy: 'code' | 'name' | 'fuzzy_code' | 'fuzzy_name' | 'order' | 'manual' | 'none';
  matchScore?: number; // 0.0 to 1.0
  rawSnippet?: string;
  isConfirmedByUser?: boolean;
}

export interface OCRWordBoundingBox {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

/**
 * Calculates Levenshtein Distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return d[m][n];
}

/**
 * Normalizes string similarity score between 0.0 and 1.0.
 */
export function stringSimilarity(a: string, b: string): number {
  const normA = a.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normB = b.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normA === normB) return 1.0;
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(normA, normB);
  return Math.max(0, parseFloat((1 - dist / maxLen).toFixed(3)));
}

/**
 * Normalizes subject codes replacing common OCR misreads (e.g., O -> 0, I/L/| -> 1, Z -> 2, S -> 5, B -> 8)
 */
export function normalizeCode(code: string): string {
  return code
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL|]/g, '1')
    .replace(/Z/g, '2')
    .replace(/S/g, '5')
    .replace(/B/g, '8')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Applies OCR error corrections for numbers, fractions, percentages, and punctuation in line text.
 */
export function sanitizeOCRLine(line: string): string {
  let cleaned = line;

  // Fix common fraction separators misread as letters or pipes e.g., "12 I 14", "12 | 14", "12 l 14", "12 / t4", "t2 / 14"
  cleaned = cleaned.replace(/\b(\d{1,3})\s*[\/\\|Iit!]\s*(\d{1,3})\b/gi, '$1 / $2');

  // Fix digits misread as 't' or 'o' in numbers e.g. "t2 / 14" -> "12 / 14"
  cleaned = cleaned.replace(/\bt(\d)\b/gi, '1$1');

  // Fix commas in float percentages e.g. "85,71%" or "85,71" -> "85.71%"
  cleaned = cleaned.replace(/(\d{1,3}),(\d{1,2})\b/g, '$1.$2');

  // Fix percentage misreads like "85.7196", "85.71o/o", "85.71 %" -> "85.71%"
  cleaned = cleaned.replace(/(\d{1,3}(?:\.\d+)?)\s*(?:96|o\/o|%\s*%|%)/gi, '$1%');

  // Normalize multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Layout-aware spatial line reconstruction from bounding boxes.
 * Groups OCR words into horizontal rows based on vertical overlapping centers.
 */
export function reconstructLinesFromWords(words: OCRWordBoundingBox[]): string[] {
  if (!words || words.length === 0) return [];

  // Filter out empty or low-confidence noise
  const validWords = words.filter((w) => w.text && w.text.trim().length > 0);

  // Sort by y0
  validWords.sort((a, b) => a.bbox.y0 - b.bbox.y0);

  const rows: OCRWordBoundingBox[][] = [];

  for (const word of validWords) {
    const wordYMid = (word.bbox.y0 + word.bbox.y1) / 2;
    const wordHeight = Math.max(10, word.bbox.y1 - word.bbox.y0);

    let foundRow = false;
    for (const row of rows) {
      // Calculate row average Y mid
      const rowYMid = row.reduce((sum, w) => sum + (w.bbox.y0 + w.bbox.y1) / 2, 0) / row.length;
      const rowAvgHeight = row.reduce((sum, w) => sum + (w.bbox.y1 - w.bbox.y0), 0) / row.length;

      // Check vertical tolerance (within 60% of word/row height)
      const tolerance = Math.min(rowAvgHeight, wordHeight) * 0.65;
      if (Math.abs(wordYMid - rowYMid) <= tolerance) {
        row.push(word);
        foundRow = true;
        break;
      }
    }

    if (!foundRow) {
      rows.push([word]);
    }
  }

  // Sort each row left-to-right by x0 and join text
  return rows.map((row) => {
    row.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    return row.map((w) => w.text).join(' ');
  });
}

/**
 * Extracts attendance numbers (fraction e.g. 12/14 or percentage e.g. 85.71%) from a text snippet.
 */
export function extractFractionOrPct(
  textSnippet: string,
  targetTotalConducted: number
): {
  pct: number | null;
  attended: number | null;
  total: number | null;
} {
  const cleanSnippet = sanitizeOCRLine(textSnippet);

  let foundPct: number | null = null;
  let foundAttended: number | null = null;
  let foundTotal: number | null = null;

  // Fraction search e.g. "12 / 14", "5/6", "0/4"
  const fractionMatches = [...cleanSnippet.matchAll(/(\d{1,3})\s*[\/\\]\s*(\d{1,3})/g)];
  if (fractionMatches.length > 0) {
    let bestFraction = fractionMatches[0];
    // Find matching denominator if possible
    for (const fm of fractionMatches) {
      const den = parseInt(fm[2], 10);
      if (den === targetTotalConducted) {
        bestFraction = fm;
        break;
      }
    }
    const att = parseInt(bestFraction[1], 10);
    const tot = parseInt(bestFraction[2], 10);
    if (tot > 0 && att <= tot) {
      foundAttended = att;
      foundTotal = tot;
      foundPct = parseFloat(((att / tot) * 100).toFixed(2));
    }
  }

  // Percentage search if fraction not found
  if (foundPct === null) {
    const pctMatches = [...cleanSnippet.matchAll(/(\d{1,3}(?:\.\d+)?)\s*%/g)];
    if (pctMatches.length > 0) {
      const val = parseFloat(pctMatches[0][1]);
      if (val >= 0 && val <= 100) {
        foundPct = parseFloat(val.toFixed(2));
      }
    }
  }

  // Standalone decimal float numbers e.g. 85.71
  if (foundPct === null) {
    const floatMatches = [...cleanSnippet.matchAll(/\b(\d{1,3}\.\d{1,2})\b/g)];
    if (floatMatches.length > 0) {
      for (const fm of floatMatches) {
        const val = parseFloat(fm[1]);
        if (val >= 0 && val <= 100) {
          foundPct = parseFloat(val.toFixed(2));
          break;
        }
      }
    }
  }

  return { pct: foundPct, attended: foundAttended, total: foundTotal };
}

/**
 * Searches for a fuzzy subject code match inside a given line.
 */
function findFuzzyCodeMatch(line: string, targetCode: string): { matched: boolean; score: number } {
  const normTarget = normalizeCode(targetCode);
  if (normTarget.length < 4) return { matched: false, score: 0 };

  const tokens = line.split(/\s+/).map((t) => normalizeCode(t)).filter((t) => t.length >= 4);

  let bestScore = 0;
  for (const tok of tokens) {
    // Exact or substring match
    if (tok.includes(normTarget) || normTarget.includes(tok)) {
      const sim = stringSimilarity(tok, normTarget);
      if (sim > bestScore) bestScore = Math.max(0.9, sim);
    } else {
      // Levenshtein distance check
      const dist = levenshteinDistance(tok, normTarget);
      if (dist <= 2) {
        const sim = 1 - dist / Math.max(tok.length, normTarget.length);
        if (sim > bestScore) bestScore = parseFloat(sim.toFixed(3));
      }
    }
  }

  return { matched: bestScore >= 0.75, score: bestScore };
}

/**
 * Searches for a fuzzy subject name match inside a given line.
 */
function findFuzzyNameMatch(
  line: string,
  subjName: string,
  isLab: boolean
): { matched: boolean; score: number } {
  const lineLower = line.toLowerCase();
  const lineHasLab = lineLower.includes('lab');

  // Lab distinction check
  if (isLab !== lineHasLab && subjName.length > 10) {
    // If subject is lab but line isn't lab (or vice versa), reduce score
    // unless name keywords match strongly
  }

  const nameKeywords = subjName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !['and', 'for', 'the', 'lab'].includes(w));

  if (nameKeywords.length === 0) return { matched: false, score: 0 };

  let hits = 0;
  for (const kw of nameKeywords) {
    if (lineLower.includes(kw)) {
      hits++;
    } else {
      // Sub-word check for slight OCR typos in name
      const lineWords = lineLower.split(/[^a-z0-9]+/);
      for (const lw of lineWords) {
        if (lw.length >= 3 && levenshteinDistance(kw, lw) <= 1) {
          hits += 0.8;
          break;
        }
      }
    }
  }

  const ratio = hits / nameKeywords.length;
  // Apply penalty if Lab mismatch
  const labPenalty = isLab !== lineHasLab ? 0.25 : 0;
  const finalScore = Math.max(0, parseFloat((ratio - labPenalty).toFixed(3)));

  const minHits = Math.min(2, nameKeywords.length);
  return { matched: hits >= minHits && finalScore >= 0.5, score: finalScore };
}

/**
 * Parses OCR text (or spatial word bounding boxes) and matches against subjects.
 * Strictly extracts percentages from top-to-bottom reading order and maps them sequentially by index:
 * OCR percentage #1 -> Subject #1
 * OCR percentage #2 -> Subject #2
 * ...
 * OCR percentage #10 -> Subject #10
 */
export function parseCampXOCRText(
  ocrInput: string | { words?: OCRWordBoundingBox[]; rawText?: string } | Array<string>,
  subjects: SubjectInfo[],
  subjectTotals: Record<string, number>
): OCRExtractedSubject[] {
  let lines: string[] = [];

  if (Array.isArray(ocrInput)) {
    // Multi-pass array of raw text
    for (const txt of ocrInput) {
      lines.push(...txt.split(/\r?\n/));
    }
  } else if (typeof ocrInput === 'object' && ocrInput.words && ocrInput.words.length > 0) {
    // Spatial layout-aware reconstruction
    const spatialLines = reconstructLinesFromWords(ocrInput.words);
    const rawLines = (ocrInput.rawText || '').split(/\r?\n/);
    lines = [...spatialLines, ...rawLines];
  } else if (typeof ocrInput === 'object' && ocrInput.rawText) {
    lines = ocrInput.rawText.split(/\r?\n/);
  } else if (typeof ocrInput === 'string') {
    lines = ocrInput.split(/\r?\n/);
  }

  const sanitizedLines = lines
    .map((l) => sanitizeOCRLine(l.trim()))
    .filter((l) => l.length > 0 && !/^attended\s*[\/\\]\s*conducted/i.test(l));

  // Extract every percentage / fraction row from top-to-bottom in reading order
  const extractedRows: Array<{
    pct: number;
    attended: number | null;
    total: number | null;
    snippet: string;
  }> = [];

  for (const line of sanitizedLines) {
    const ext = extractFractionOrPct(line, 0);
    if (ext.pct !== null) {
      extractedRows.push({
        pct: ext.pct,
        attended: ext.attended,
        total: ext.total,
        snippet: line,
      });
    }
  }

  const results: OCRExtractedSubject[] = [];

  for (let idx = 0; idx < subjects.length; idx++) {
    const subj = subjects[idx];
    const targetTotal = subjectTotals[subj.id] || 1;

    let finalPct = 80;
    let finalAttended = Math.round(0.8 * targetTotal);
    let confidence: 'high' | 'medium' | 'low' = 'low';
    let snippet = '';

    if (idx < extractedRows.length) {
      const extRow = extractedRows[idx];
      finalPct = extRow.pct;
      snippet = extRow.snippet;
      if (extRow.attended !== null) {
        finalAttended = extRow.attended;
      } else {
        finalAttended = Math.round((finalPct / 100) * targetTotal);
      }
      confidence = 'high';
    }

    results.push({
      subjectId: subj.id,
      subjectCode: subj.code,
      subjectName: subj.name,
      extractedPercentage: finalPct,
      extractedAttended: Math.min(targetTotal, Math.max(0, finalAttended)),
      extractedTotal: targetTotal,
      confidence,
      matchedBy: 'order',
      matchScore: 1.0,
      rawSnippet: snippet || undefined,
    });
  }

  return results;
}
