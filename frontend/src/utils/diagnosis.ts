export const COMMON_CLINIC_DIAGNOSES: string[] = [
  'Acute Upper Respiratory Tract Infection (URTI)',
  'Acute Bronchitis',
  'Pneumonia',
  'Malaria (P. falciparum)',
  'Malaria (P. vivax)',
  'Typhoid Fever',
  'Acute Gastroenteritis (AGE)',
  'Urinary Tract Infection (UTI)',
  'Peptic Ulcer Disease (PUD)',
  'Acute Gastritis / Dyspepsia',
  'Acute Tonsillitis / Pharyngitis',
  'Essential Hypertension',
  'Type 2 Diabetes Mellitus',
  'Type 1 Diabetes Mellitus',
  'Bronchial Asthma',
  'Acute Allergic Rhinitis',
  'Amebiasis / Giardiasis',
  'Intestinal Helminthiasis',
  'Contact Dermatitis / Eczema',
  'Fungal Skin Infection (Tinea)',
  'Scabies',
  'Acute Otitis Media',
  'Acute Bacterial Conjunctivitis',
  'Tension Headache',
  'Migraine without Aura',
  'Musculoskeletal Lower Back Pain',
  'Iron Deficiency Anemia',
  'Skin Abscess / Furunculosis',
  'Cellulitis',
  'Soft Tissue Injury / Sprain',
];

export function searchDiagnoses(query: string, candidates: string[] = []): string[] {
  const normalizedQuery = query.trim().toLowerCase();
  const seen = new Set<string>();
  const combined: string[] = [];

  // Merge custom candidates first, then standard formulary
  for (const item of [...candidates, ...COMMON_CLINIC_DIAGNOSES]) {
    const clean = normalizeDiagnosis(item);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(clean);
    }
  }

  if (!normalizedQuery) {
    return combined.slice(0, 10);
  }

  // Rank: exact match, starts-with, word-starts-with, contains
  const exact: string[] = [];
  const startsWith: string[] = [];
  const wordStarts: string[] = [];
  const contains: string[] = [];

  for (const item of combined) {
    const lower = item.toLowerCase();
    if (lower === normalizedQuery) {
      exact.push(item);
    } else if (lower.startsWith(normalizedQuery)) {
      startsWith.push(item);
    } else if (lower.split(/[\s(/]+/).some(word => word.startsWith(normalizedQuery))) {
      wordStarts.push(item);
    } else if (lower.includes(normalizedQuery)) {
      contains.push(item);
    }
  }

  return [...exact, ...startsWith, ...wordStarts, ...contains].slice(0, 12);
}

export function diagnosisKey(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex];
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

export function diagnosisSuggestions(value: string, candidates: string[]): string[] {
  const key = diagnosisKey(value);
  if (key.length < 4) return [];

  const uniqueCandidates = new Map<string, string>();
  candidates.forEach(candidate => {
    const candidateKey = diagnosisKey(candidate);
    if (candidateKey && candidateKey !== key && !uniqueCandidates.has(candidateKey)) {
      uniqueCandidates.set(candidateKey, candidate.trim().replace(/\s+/g, ' '));
    }
  });

  const maxDistance = key.length >= 8 ? 2 : 1;
  return [...uniqueCandidates.entries()]
    .filter(([candidateKey]) => Math.abs(key.length - candidateKey.length) <= maxDistance)
    .map(([candidateKey, label]) => ({ label, distance: editDistance(key, candidateKey) }))
    .filter(candidate => candidate.distance <= maxDistance)
    .sort((left, right) => left.distance - right.distance || left.label.localeCompare(right.label))
    .slice(0, 3)
    .map(candidate => candidate.label);
}

/**
 * Diagnosis display helpers.
 *
 * Older records can contain placeholder text instead of a real diagnosis.
 * Treat those values as empty everywhere so tables, details and analytics do
 * not present an "in progress" note as a clinical finding.
 */

const PLACEHOLDER_DIAGNOSES = new Set([
  '',
  'assessment in progress',
  'not recorded',
  'n/a',
  'na',
  'none',
  'undiagnosed / routine check',
  'undiagnosed',
  '—',
  '-',
]);

export function normalizeDiagnosis(value?: string | null): string {
  const text = (value ?? '').trim();
  return PLACEHOLDER_DIAGNOSES.has(text.toLowerCase()) ? '' : text;
}

export function hasDiagnosis(value?: string | null): boolean {
  return normalizeDiagnosis(value).length > 0;
}

export function diagnosisLabel(value?: string | null, referred = false): string {
  return normalizeDiagnosis(value) || (referred ? 'Referred' : 'N/A');
}
