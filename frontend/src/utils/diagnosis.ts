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
