import { requireSupabase } from '@/lib/supabase';
import type { CheckInResult, UserProfile } from '@/types/match';

export const profileService = {
  async getMyProfile(userId: string, fallbackUsername: string): Promise<UserProfile> {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, username, source_points, streak_days, last_checkin_date')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return {
        userId,
        username: fallbackUsername,
        sourcePoints: 0,
        streakDays: 0,
        lastCheckinDate: null,
      };
    }

    return {
      userId: data.user_id as string,
      username: data.username as string,
      sourcePoints: (data.source_points as number) ?? 0,
      streakDays: (data.streak_days as number) ?? 0,
      lastCheckinDate: (data.last_checkin_date as string | null) ?? null,
    };
  },

  async dailyCheckIn(): Promise<CheckInResult> {
    const supabase = requireSupabase();
    const { data, error } = await supabase.rpc('daily_checkin');
    if (error) {
      throw new Error(error.message);
    }
    return data as CheckInResult;
  },
};
