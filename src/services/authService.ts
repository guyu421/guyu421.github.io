import type { User as SupabaseUser } from '@supabase/supabase-js';
import { requireSupabase, supabase } from '@/lib/supabase';
import type { User } from '@/types/auth';

export function mapSupabaseUser(u: SupabaseUser | null): User | null {
  if (!u) return null;
  const email = u.email ?? '';
  const username =
    (u.user_metadata?.username as string | undefined)?.trim() ||
    email.split('@')[0] ||
    '棋友';
  return {
    id: u.id,
    email,
    username,
  };
}

export const authService = {
  async register(email: string, password: string, username: string): Promise<User | null> {
    const client = requireSupabase();
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          username: username.trim(),
        },
      },
    });
    if (error) {
      throw new Error(error.message);
    }
    return mapSupabaseUser(data.user);
  },

  async login(email: string, password: string): Promise<User | null> {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      throw new Error(error.message);
    }
    return mapSupabaseUser(data.user);
  },

  async logout(): Promise<void> {
    if (!supabase) return;
    await supabase.auth.signOut();
  },
};
