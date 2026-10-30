const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

async function request<T>(path: string, options: RequestOptions = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
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
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
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
