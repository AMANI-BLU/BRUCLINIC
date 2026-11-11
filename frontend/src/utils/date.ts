export function formatDateWithFallback(value?: string, fallback?: string): string {
  for (const candidate of [value, fallback]) {
    if (!candidate) continue;
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString();
  }
  return 'Date unavailable';
}

/** Display stored times consistently as 12-hour clock values. */
export function formatTime12(value?: string | null): string {
  if (!value) return '—';
  const raw = String(value).trim();
  const timeOnly = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*([ap]m))?$/i);
  if (timeOnly) {
    let hours = Number(timeOnly[1]);
    const minutes = timeOnly[2];
    const suffix = timeOnly[3]?.toUpperCase() || (hours >= 12 ? 'PM' : 'AM');
    if (!timeOnly[3]) hours %= 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${suffix}`;
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  return raw;
}

export function formatDateTime12(value?: string | null, fallback?: string | null): string {
  const candidate = value || fallback;
  if (!candidate) return 'Date unavailable';
  const date = new Date(candidate);
  if (!Number.isNaN(date.getTime())) {
    const dateLabel = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return /^\d{4}-\d{2}-\d{2}$/.test(String(candidate).trim()) ? dateLabel : `${dateLabel} ${formatTime12(candidate)}`;
  }
  return `${candidate} (${formatTime12(candidate)})`;
}
