import { X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = '确认删除',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      className="wx-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div className="wx-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="wx-modal-header">
          <strong style={{ fontSize: '1.02rem' }}>{title}</strong>
          <button
            type="button"
            aria-label="关闭弹窗"
            disabled={loading}
            onClick={onCancel}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              padding: 4,
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: '0.9rem',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>

        <div className="wx-modal-footer">
          <button
            type="button"
            className="category-pill"
            disabled={loading}
            onClick={onCancel}
            style={{ padding: '6px 14px', fontSize: '0.84rem' }}
          >
            取消
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            style={{
              border: '1px solid #fecaca',
              background: '#dc2626',
              color: '#ffffff',
              borderRadius: '999px',
              padding: '6px 16px',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading ? '删除中...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
