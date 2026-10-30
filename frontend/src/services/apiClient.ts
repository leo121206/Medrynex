function resolveApiBase(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return '/api/v1';
  return raw.endsWith('/api/v1') ? raw : `${raw}/api/v1`;
}

export const API_BASE = resolveApiBase();

// ── Token storage ─────────────────────────────────────────────────────────────
// Access token: short-lived JWT kept in localStorage + HttpOnly cookie.
// Refresh token: long-lived opaque token rotated on 401 via localStorage + HttpOnly cookie.

export const TOKEN_KEY = 'medrynx_token';
export const REFRESH_TOKEN_KEY = 'medrynx_refresh_token';

export const getAuthToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const setAuthToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY);

export const setRefreshToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

export const clearAllTokens = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

// ── Refresh token rotation ────────────────────────────────────────────────────

let refreshPromise: Promise<string> | null = null;

async function doTokenRefresh(): Promise<string> {
  const rt = getRefreshToken();
  if (!rt) throw new Error('No refresh token available');

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  });

  const json = await response.json();
  if (!response.ok || json.success === false) {
    clearAllTokens();
    throw new Error('Session expired. Please log in again.');
  }

  const { token, refreshToken } = json.data as { token: string; refreshToken: string };
  setAuthToken(token);
  setRefreshToken(refreshToken);
  return token;
}

/**
 * Rotate refresh token only once even if multiple concurrent requests fail with 401.
 */
export async function rotateAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = doTokenRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ── Request factory ───────────────────────────────────────────────────────────

interface RequestOptions extends RequestInit {
  data?: unknown;
  /** Skip auto-refresh on 401 (used by the refresh call itself) */
  _skipRetry?: boolean;
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let body = options.body;
  if (options.data && !(options.data instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.data);
  } else if (options.data instanceof FormData) {
    body = options.data;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: options.credentials || 'include',
    headers,
    body,
  });

  // Auto-refresh on 401 (expired access token)
  if (response.status === 401 && !options._skipRetry) {
    try {
      const newToken = await rotateAccessToken();
      const retryHeaders = new Headers(headers);
      retryHeaders.set('Authorization', `Bearer ${newToken}`);
      const retryResponse = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        credentials: options.credentials || 'include',
        headers: retryHeaders,
        body,
      });
      const retryJson = await retryResponse.json();
      if (!retryResponse.ok || retryJson.success === false) {
        throw new Error(retryJson?.error?.message || retryJson?.message || `HTTP ${retryResponse.status}`);
      }
      return retryJson.data as T;
    } catch {
      clearAllTokens();
      // Redirect to login — navigating from outside React context
      window.location.href = '/login?expired=1';
      throw new Error('Session expired');
    }
  }

  const json = await response.json();

  if (!response.ok || json.success === false) {
    const errorMsg = json?.error?.message || json?.message || `HTTP Error ${response.status}`;
    throw new Error(errorMsg);
  }

  return json.data as T;
}
