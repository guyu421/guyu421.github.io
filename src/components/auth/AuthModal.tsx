import { X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/store/AuthContext';

export function AuthModal() {
  const { authModalOpen, closeAuthModal, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!authModalOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register(username, password);
      }
      setUsername('');
      setPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'login' ? '账号登录' : '注册账号'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={closeAuthModal}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 400, padding: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 18,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
            {mode === 'login' ? '登录赛源网' : '注册赛源网账号'}
          </h2>
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="关闭"
            style={{
              border: 'none',
              background: 'transparent',
              padding: 4,
              color: 'var(--color-text-muted)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label
              htmlFor="auth-username"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}
            >
              用户名
            </label>
            <input
              id="auth-username"
              type="text"
              required
              minLength={2}
              maxLength={24}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="2-24 个字符"
              style={{
                width: '100%',
                height: 38,
                padding: '0 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                fontSize: '0.92rem',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}
            >
              密码
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              style={{
                width: '100%',
                height: 38,
                padding: '0 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                fontSize: '0.92rem',
              }}
            />
          </div>

          {error ? (
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--color-live)' }}>
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="category-pill active"
            style={{ height: 40, fontSize: '0.92rem', marginTop: 4 }}
          >
            {submitting ? '提交中...' : mode === 'login' ? '登录' : '注册并登录'}
          </button>
        </form>

        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: '1px solid var(--color-surface-muted)',
            textAlign: 'center',
            fontSize: '0.85rem',
            color: 'var(--color-text-secondary)',
          }}
        >
          {mode === 'login' ? '还没有账号？' : '已有账号？'}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--color-primary)',
              fontWeight: 700,
              marginLeft: 4,
            }}
          >
            {mode === 'login' ? '立即注册' : '去登录'}
          </button>
        </div>
      </div>
    </div>
  );
}
