const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
export const AUTH_TOKEN_KEY = 'saiyuan_token';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let message = response.statusText || '请求失败';
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // ignore non-JSON error body
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}
