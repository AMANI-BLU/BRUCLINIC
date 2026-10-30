import { useEffect } from 'react';
import { AlertTriangle, Trash2, X, AlertCircle } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  icon?: 'trash' | 'warning' | 'alert';
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  icon = 'trash',
  onConfirm,
  onClose,
  isLoading = false,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const iconColor =
    variant === 'danger' ? '#ef4444' : variant === 'warning' ? '#f59e0b' : '#3b82f6';
  const iconBg =
    variant === 'danger'
      ? 'rgba(239, 68, 68, 0.12)'
      : variant === 'warning'
      ? 'rgba(245, 158, 11, 0.12)'
      : 'rgba(59, 130, 246, 0.12)';

  const confirmBtnClass =
    variant === 'danger'
      ? 'btn btn-danger'
      : variant === 'warning'
      ? 'btn btn-warning'
      : 'btn btn-primary';

  return (
    <div className="modal-overlay" onClick={() => !isLoading && onClose()}>
      <div
        className="modal"
        style={{
          maxWidth: 420,
          width: '100%',
          padding: '1.25rem',
          borderRadius: 'var(--radius-lg, 10px)',
          animation: 'fadeIn 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: iconBg,
                color: iconColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {icon === 'trash' ? (
                <Trash2 size={18} />
              ) : icon === 'alert' ? (
                <AlertCircle size={18} />
              ) : (
                <AlertTriangle size={18} />
              )}
            </div>
            <h3 id="confirm-modal-title" className="modal-title" style={{ fontSize: '1.02rem', margin: 0 }}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '0.5rem 0 1rem 0', color: 'var(--clr-text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
          {message}
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem', paddingTop: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isLoading}
            style={{ minWidth: 80, padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={confirmBtnClass}
            onClick={onConfirm}
            disabled={isLoading}
            style={{ minWidth: 90, padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 600 }}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
