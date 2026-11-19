import type { AuthResponse, User } from '@/types/auth';
import { apiRequest } from './apiClient';

export const authService = {
  async register(username: string, password: string): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  async login(username: string, password: string): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  async me(): Promise<{ user: User }> {
    return apiRequest<{ user: User }>('/api/auth/me');
  },
};
