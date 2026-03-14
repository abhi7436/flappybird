const RAW_API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').trim();

export const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, '');

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
}

export function websocketUrl(): string {
  const explicit = (import.meta.env.VITE_WS_URL ?? '').trim();
  if (explicit) return explicit;
  if (!API_BASE_URL) return '';

  try {
    const url = new URL(API_BASE_URL);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export async function parseJsonResponse<T>(res: Response): Promise<T> {
  const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
  const text = await res.text();

  if (!text) return {} as T;

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Server returned malformed JSON (HTTP ${res.status})`);
    }
  }

  const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 140);
  throw new Error(
    `Expected JSON but received ${contentType || 'non-JSON'} (HTTP ${res.status}). ${snippet}`
  );
}

export function apiErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const payload = data as Record<string, unknown>;
  if (typeof payload.error === 'string') return payload.error;
  if (typeof payload.message === 'string') return payload.message;
  return fallback;
}
