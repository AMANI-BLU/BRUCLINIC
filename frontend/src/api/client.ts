const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 12_000;

export const NETWORK_ERROR_MESSAGE =
  'Unable to reach the clinic server. Check your network connection and try again.';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Let the connectivity banner and data loaders know whether the API is reachable. */
function reportNetworkState(reachable: boolean) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('bruclinic:network-state', { detail: reachable }));
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

async function request<T>(path: string, options: RequestOptions = {}, token?: string | null): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    reportNetworkState(false);
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  }
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    reportNetworkState(false);
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  } finally {
    window.clearTimeout(timeoutId);
  }
  reportNetworkState(true);
  const text = await response.text();
  let payload: any = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  if (!response.ok) {
    throw new ApiError(payload?.error || payload?.message || `Request failed (${response.status})`, response.status);
  }
  return payload as T;
}

export function apiGet<T>(path: string, token?: string | null) {
  return request<T>(path, { method: 'GET' }, token);
}

export function apiPost<T>(path: string, body: unknown, token?: string | null) {
  return request<T>(path, { method: 'POST', body }, token);
}

export function apiPatch<T>(path: string, body: unknown, token?: string | null) {
  return request<T>(path, { method: 'PATCH', body }, token);
}

export function apiDelete<T = { data?: unknown }>(path: string, token?: string | null) {
  return request<T>(path, { method: 'DELETE' }, token);
}

/**
 * Download a server-generated file (e.g. a database backup).
 * Uses the Content-Disposition filename when the server provides one.
 */
export async function apiDownload(path: string, fallbackName: string, token?: string | null): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    reportNetworkState(false);
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  }
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: controller.signal,
    });
  } catch {
    reportNetworkState(false);
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  } finally {
    window.clearTimeout(timeoutId);
  }
  reportNetworkState(true);
  if (!response.ok) {
    const text = await response.text();
    let payload: any = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
    throw new ApiError(payload?.error || payload?.message || `Download failed (${response.status})`, response.status);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/i.exec(disposition);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = match?.[1] || fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function apiList<T>(resource: string, token: string | null, params: Record<string, string | number | undefined> = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  return apiGet<{ data: T[]; total: number; limit: number; offset: number }>(`/${resource}${query.toString() ? `?${query}` : ''}`, token);
}
