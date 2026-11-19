import { Award, CalendarCheck, LogOut, Sparkles, User as UserIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { profileService } from '@/services/profileService';
import { useAuth } from '@/store/AuthContext';
import type { UserProfile } from '@/types/match';

function getTodayBeijingDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
  }).format(new Date());
}

function getLevelInfo(points: number) {
  const level = Math.floor(points / 100) + 1;
  const currentLevelExp = points % 100;
  return { level, currentLevelExp, nextLevelExp: 100 };
}

export function ProfilePage() {
  const { user, openAuthModal, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    let active = true;
    setLoading(true);
    profileService
      .getMyProfile(user.id, user.username)
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch(() => {
        if (active) {
          setProfile({
            userId: user.id,
            username: user.username,
            sourcePoints: 0,
            streakDays: 0,
            lastCheckinDate: null,
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  async function handleCheckIn() {
    if (!user || checkingIn) return;
    setCheckingIn(true);
    setMessage(null);

    try {
      const res = await profileService.dailyCheckIn();
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              sourcePoints: res.sourcePoints,
              streakDays: res.streakDays,
              lastCheckinDate: res.checkinDate,
            }
          : {
              userId: user.id,
              username: user.username,
              sourcePoints: res.sourcePoints,
              streakDays: res.streakDays,
              lastCheckinDate: res.checkinDate,
            },
      );
      setMessage(
        res.alreadyCheckedIn
          ? '今日已签到，明天再来领取源点吧'
          : `签到成功！获得 +${res.pointsEarned} 源点`,
      );
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : '签到失败，请稍后重试');
    } finally {
      setCheckingIn(false);
    }
  }

  if (!user) {
    return (
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--color-surface-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
              color: 'var(--color-text-muted)',
            }}
          >
            <UserIcon size={26} />
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: '1.25rem' }}>欢迎来到赛源网</h1>
          <p style={{ margin: '0 0 20px', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            登录后即可每日签到领取源点经验值，并参与文章评价讨论
          </p>
          <button
            type="button"
            className="category-pill active"
            onClick={openAuthModal}
            style={{ padding: '9px 22px', fontSize: '0.92rem' }}
          >
            登录 / 注册
          </button>
        </div>
      </div>
    );
  }

  const points = profile?.sourcePoints ?? 0;
  const streak = profile?.streakDays ?? 0;
  const todayCheckedIn = profile?.lastCheckinDate === getTodayBeijingDate();
  const { level, currentLevelExp, nextLevelExp } = getLevelInfo(points);

  return (
    <div className="container" style={{ maxWidth: 680 }}>
      <div className="card" style={{ padding: 24, marginBottom: 18 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'var(--color-header-bg)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.2rem',
              }}
            >
              {user.username.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: '1.15rem' }}>{user.username}</strong>
                <span className="badge badge-breaking">Lv.{level}</span>
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                {user.email}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="category-pill"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <LogOut size={14} />
            退出登录
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.85rem',
                color: 'var(--color-text-muted)',
                marginBottom: 4,
              }}
            >
              <Sparkles size={15} color="#f59e0b" />
              我的源点（经验值）
            </div>
            <div
              className="tabular-nums"
              style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.1 }}
            >
              {loading ? '...' : points}
            </div>
          </div>

          <button
            type="button"
            disabled={checkingIn || todayCheckedIn}
            onClick={handleCheckIn}
            className="category-pill active"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 18px',
              fontSize: '0.92rem',
              opacity: todayCheckedIn ? 0.65 : 1,
            }}
          >
            <CalendarCheck size={16} />
            {checkingIn
              ? '签到中...'
              : todayCheckedIn
                ? '今日已签到 (+10)'
                : '每日签到 (+10 源点)'}
          </button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
              color: 'var(--color-text-muted)',
              marginBottom: 6,
            }}
          >
            <span>当前等级 Lv.{level}</span>
            <span className="tabular-nums">
              {currentLevelExp} / {nextLevelExp} 源点升级
            </span>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: 'var(--color-surface-muted)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${currentLevelExp}%`,
                height: '100%',
                background: 'var(--color-primary)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.85rem',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Award size={15} color="#10b981" />
          <span>已连续签到 {streak} 天</span>
        </div>

        {message ? (
          <p
            style={{
              margin: '12px 0 0',
              fontSize: '0.86rem',
              color: 'var(--color-primary)',
              fontWeight: 600,
            }}
          >
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
