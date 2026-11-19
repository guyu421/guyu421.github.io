import type { AuthResponse, User } from '@/types/auth';
import { ApiError, apiRequest } from './apiClient';

const USE_STATIC_DB_EXPORT =
  import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL;
const DISPATCH_ENDPOINT = import.meta.env.VITE_DISPATCH_ENDPOINT ?? '';
export const STATIC_USER_KEY = 'saiyuan_static_user';

interface StaticUserRecord {
  id: string;
  username: string;
  passwordHash: string;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function derivePbkdf2Hex(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );
  return toHex(new Uint8Array(bits));
}

async function hashPasswordInBrowser(password: string): Promise<string> {
  const saltBytes = new Uint8Array(16);
  window.crypto.getRandomValues(saltBytes);
  const salt = toHex(saltBytes);
  const derived = await derivePbkdf2Hex(password, salt);
  return `${salt}:${derived}`;
}

async function verifyPasswordInBrowser(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  const actualHex = await derivePbkdf2Hex(password, salt);
  return actualHex === expectedHex;
}

async function fetchStaticUsers(): Promise<StaticUserRecord[]> {
  try {
    return await apiRequest<StaticUserRecord[]>('/static-api/users.json');
  } catch {
    return [];
  }
}

export const authService = {
  async register(username: string, password: string): Promise<AuthResponse> {
    if (USE_STATIC_DB_EXPORT) {
      if (!DISPATCH_ENDPOINT) {
        throw new ApiError(
          '当前为纯静态站点，尚未配置异步写入转发层（VITE_DISPATCH_ENDPOINT）或后端 API（VITE_API_BASE_URL）',
          503,
        );
      }

      const trimmed = username.trim();
      const users = await fetchStaticUsers();
      if (users.some((u) => u.username === trimmed)) {
        throw new ApiError('该用户名已被注册', 409);
      }

      const id = window.crypto.randomUUID();
      const passwordHash = await hashPasswordInBrowser(password);

      const res = await fetch(DISPATCH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'register-user',
          client_payload: { id, username: trimmed, passwordHash },
        }),
      });

      if (!res.ok) {
        throw new ApiError('注册请求发送失败，请稍后重试', res.status);
      }

      const user: User = { id, username: trimmed };
      window.localStorage.setItem(STATIC_USER_KEY, JSON.stringify(user));
      return { token: 'static-session', user };
    }

    return apiRequest<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  async login(username: string, password: string): Promise<AuthResponse> {
    if (USE_STATIC_DB_EXPORT) {
      const trimmed = username.trim();
      const users = await fetchStaticUsers();
      const found = users.find((u) => u.username === trimmed);
      if (!found || !(await verifyPasswordInBrowser(password, found.passwordHash))) {
        throw new ApiError('用户名或密码错误（若刚注册请等待约 30-60 秒同步）', 401);
      }

      const user: User = { id: found.id, username: found.username };
      window.localStorage.setItem(STATIC_USER_KEY, JSON.stringify(user));
      return { token: 'static-session', user };
    }

    return apiRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  async me(): Promise<{ user: User }> {
    if (USE_STATIC_DB_EXPORT) {
      const raw = window.localStorage.getItem(STATIC_USER_KEY);
      if (!raw) throw new ApiError('未登录', 401);
      return { user: JSON.parse(raw) as User };
    }

    return apiRequest<{ user: User }>('/api/auth/me');
  },
};
