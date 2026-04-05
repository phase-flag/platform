/**
 * Portal API client — thin fetch wrapper with error handling for
 * 401 (auth), 402 (payment required), 403 (tier-gated), and 429 (rate limit).
 *
 * Error toasts are dispatched as 'phaseflag:toast' CustomEvents so that the
 * ToastContext (React) can pick them up without a direct context reference here.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function dispatchToast(type: 'success' | 'error' | 'info' | 'warning', message: string, link?: string) {
  window.dispatchEvent(new CustomEvent('phaseflag:toast', { detail: { type, message, link } }));
}

function getToken(): string | null {
  return localStorage.getItem('pf_token');
}

function handleUnauthorized() {
  localStorage.removeItem('pf_token');
  localStorage.removeItem('pf_user');
  window.location.href = '/login';
}

async function handleErrorResponse(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({})) as { detail?: string };
  const serverMessage = body.detail ?? '';

  switch (res.status) {
    case 401:
      handleUnauthorized();
      throw new Error('Unauthorized');

    case 402:
      dispatchToast('error', 'This action requires a plan upgrade.', '/billing');
      throw new Error(serverMessage || 'Payment required');

    case 403: {
      const tierKeywords = ['plan', 'tier', 'upgrade', 'pro', 'enterprise', 'feature'];
      const isTierGated = tierKeywords.some((kw) => serverMessage.toLowerCase().includes(kw));
      if (isTierGated) {
        dispatchToast('error', 'This feature is available on the Pro plan.');
      }
      throw new Error(serverMessage || 'Forbidden');
    }

    case 429: {
      const retryAfter = res.headers.get('retry-after');
      const msg = retryAfter
        ? `Rate limit exceeded. Please wait ${retryAfter} second(s) before trying again.`
        : 'Rate limit exceeded. Please wait a moment before trying again.';
      dispatchToast('error', msg);
      throw new Error(msg);
    }

    case 500:
      throw new Error('An unexpected error occurred. Please try again.');

    default:
      throw new Error(serverMessage || `Request failed with status ${res.status}`);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Skip attaching the auth token (e.g. for public endpoints) */
  public?: boolean;
}

export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, public: isPublic = false } = options;

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (!isPublic) {
    const token = getToken();
    if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method,
    headers: reqHeaders,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    await handleErrorResponse(res);
  }

  // 204 No Content — return empty object
  if (res.status === 204) return {} as T;

  return res.json() as Promise<T>;
}

export default apiFetch;
