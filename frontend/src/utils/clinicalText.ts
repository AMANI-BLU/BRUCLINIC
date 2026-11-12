/**
 * Clinical text is entered by several departments and older records may
 * contain light Markdown copied from notes. Keep the content readable in
 * cards and printed documents without introducing a Markdown renderer.
 */
export function cleanClinicalText(value?: unknown): string {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/\r\n?/g, '\n')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*(?:clinical\s+notes?|symptoms?)\s*:\s*/i, '')
    .replace(/^\s*(?:clinical\s+notes?|symptoms?)\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function clinicalTextHtml(value?: unknown): string {
  return escapeHtml(cleanClinicalText(value)).replace(/\n/g, '<br />');
}
