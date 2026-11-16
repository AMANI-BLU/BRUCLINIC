export function stripDoctorTitle(name?: string | null): string {
  return String(name || '')
    .trim()
    .replace(/^(?:(?:dr\.?|doctor)\s+)+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeDoctorName(name?: string | null): string {
  const rawName = String(name || '').trim();
  const hasTitle = /^(?:dr\.?|doctor)\s+/i.test(rawName);
  const cleanName = stripDoctorTitle(rawName);
  return cleanName ? (hasTitle ? `Dr. ${cleanName}` : cleanName) : '';
}

export function formatDoctorName(name?: string | null, fallback = 'Clinician'): string {
  const cleanName = stripDoctorTitle(name);
  return cleanName ? `Dr. ${cleanName}` : fallback;
}
