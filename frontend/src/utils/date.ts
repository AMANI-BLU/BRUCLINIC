export function formatDateWithFallback(value?: string, fallback?: string): string {
  for (const candidate of [value, fallback]) {
    if (!candidate) continue;
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString();
  }
  return 'Date unavailable';
}