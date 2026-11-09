import { useState, useMemo, useEffect } from 'react';
import {
  Bell, X, Search, CheckCircle2, type LucideIcon, ArrowRight, CheckCheck, Trash2
} from 'lucide-react';
import ModalPortal from './ModalPortal';

export interface ClinicAlert {
  id: string;
  category: 'er' | 'pharmacy' | 'lab' | 'queue' | 'stock';
  categoryLabel: string;
  priority: 'critical' | 'urgent' | 'normal';
  title: string;
  message: string;
  time?: string;
  link: string;
  icon: LucideIcon;
}

interface AllNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: ClinicAlert[];
  onMarkAllRead: () => void;
  onClearAllAlerts: () => void;
  onDismissAlert: (id: string) => void;
  onNavigate: (link: string) => void;
  roleTitle?: string;
}

export default function AllNotificationsModal({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onClearAllAlerts,
  onDismissAlert,
  onNavigate,
  roleTitle = 'Staff',
}: AllNotificationsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'critical' | 'er' | 'pharmacy' | 'lab' | 'queue' | 'stock'>('all');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const categories = useMemo(() => {
    const counts: Record<string, number> = { all: notifications.length };
    const criticalCount = notifications.filter(n => n.priority === 'critical').length;
    counts.critical = criticalCount;

    notifications.forEach(n => {
      counts[n.category] = (counts[n.category] || 0) + 1;
    });

    return [
      { id: 'all', label: `All Alerts (${notifications.length})` },
      ...(criticalCount > 0 ? [{ id: 'critical', label: `Critical (${criticalCount})` }] : []),
      ...(counts.er ? [{ id: 'er', label: `Emergency (${counts.er})` }] : []),
      ...(counts.pharmacy ? [{ id: 'pharmacy', label: `Pharmacy (${counts.pharmacy})` }] : []),
      ...(counts.stock ? [{ id: 'stock', label: `Stock Warnings (${counts.stock})` }] : []),
      ...(counts.lab ? [{ id: 'lab', label: `Laboratory (${counts.lab})` }] : []),
      ...(counts.queue ? [{ id: 'queue', label: `Queue & OPD (${counts.queue})` }] : []),
    ];
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter(item => {
      if (selectedCategory === 'critical') {
        if (item.priority !== 'critical') return false;
      } else if (selectedCategory !== 'all') {
        if (item.category !== selectedCategory) return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.message.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [notifications, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1055, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)' }}
        onClick={onClose}
      />
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="all-notifications-title"
        style={{ zIndex: 1056 }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable" style={{ maxWidth: 780 }}>
          <div
            className="modal-content shadow-lg border-0"
            style={{
              borderRadius: '0.65rem',
              backgroundColor: 'var(--clr-bg-surface, #ffffff)',
              color: 'var(--clr-text-primary, #0f172a)',
              border: '1px solid var(--clr-border, #e2e8f0)',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div
              className="modal-header py-3 px-4"
              style={{
                borderBottom: '1px solid var(--clr-border, #e2e8f0)',
                backgroundColor: 'var(--clr-bg-card, #f8fafc)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0, 123, 255, 0.12)',
                    color: 'var(--clr-primary-500, #007bff)',
                    display: 'grid',
                    placeItems: 'center'
                  }}
                >
                  <Bell size={20} />
                </div>
                <div>
                  <h5 className="modal-title m-0" id="all-notifications-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                    Clinic Live Alerts &amp; Notifications
                  </h5>
                  <small style={{ color: 'var(--clr-text-muted, #64748b)', fontSize: '0.78rem' }}>
                    Active departmental notifications filtered for <strong>{roleTitle}</strong>
                  </small>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {notifications.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: '0.35rem' }}
                      onClick={onClearAllAlerts}
                      title="Clear and delete all notifications"
                    >
                      <Trash2 size={13} />
                      Clear all
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: '0.35rem' }}
                      onClick={onMarkAllRead}
                      title="Mark all notifications as read"
                    >
                      <CheckCheck size={14} />
                      Mark read
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={onClose}
                  style={{ padding: '0.5rem', margin: 0 }}
                />
              </div>
            </div>

            {/* Filter toolbar & Search */}
            <div
              className="p-3"
              style={{
                borderBottom: '1px solid var(--clr-border, #e2e8f0)',
                backgroundColor: 'var(--clr-bg-surface, #ffffff)'
              }}
            >
              <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--clr-text-muted, #94a3b8)',
                    pointerEvents: 'none'
                  }}
                />
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Search notifications by patient name, medication, or complaint..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    paddingLeft: '2.4rem',
                    borderRadius: '0.35rem',
                    fontSize: '0.82rem',
                    backgroundColor: 'var(--clr-bg-input, #f8fafc)',
                    border: '1px solid var(--clr-border, #cbd5e1)'
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--clr-text-muted, #94a3b8)',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Category chips */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.4rem',
                  overflowX: 'auto',
                  paddingBottom: '0.2rem',
                  scrollbarWidth: 'none'
                }}
              >
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id as any)}
                    className={`btn btn-sm ${selectedCategory === cat.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                    style={{
                      fontSize: '0.74rem',
                      padding: '0.25rem 0.65rem',
                      borderRadius: '999px',
                      whiteSpace: 'nowrap',
                      fontWeight: selectedCategory === cat.id ? 600 : 500
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notification items list */}
            <div
              className="modal-body p-3"
              style={{
                maxHeight: '480px',
                overflowY: 'auto',
                backgroundColor: 'var(--clr-bg-base, #f1f5f9)'
              }}
            >
              {filteredNotifications.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '3rem 1rem',
                    textAlign: 'center',
                    color: 'var(--clr-text-muted, #64748b)'
                  }}
                >
                  <CheckCircle2 size={36} style={{ color: '#10b981', marginBottom: '0.75rem' }} />
                  <strong style={{ fontSize: '0.95rem', color: 'var(--clr-text-primary, #0f172a)' }}>
                    {searchQuery ? 'No matching notifications found' : 'No active notifications'}
                  </strong>
                  <p style={{ fontSize: '0.8rem', margin: '0.35rem 0 0', maxWidth: 360 }}>
                    {searchQuery
                      ? 'Try modifying your search query or switching to another category.'
                      : 'All clinical queues, emergency beds, and orders in this category are up to date.'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {filteredNotifications.map(alert => {
                    const IconComponent = alert.icon;
                    const isCritical = alert.priority === 'critical';
                    const isUrgent = alert.priority === 'urgent';

                    const priorityBg = isCritical ? 'rgba(239, 68, 68, 0.1)' : isUrgent ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)';
                    const priorityColor = isCritical ? '#dc2626' : isUrgent ? '#d97706' : '#2563eb';
                    const priorityBorder = isCritical ? 'rgba(239, 68, 68, 0.3)' : isUrgent ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.25)';

                    return (
                      <div
                        key={alert.id}
                        style={{
                          backgroundColor: 'var(--clr-bg-card, #ffffff)',
                          border: `1px solid ${priorityBorder}`,
                          borderLeft: `4px solid ${priorityColor}`,
                          borderRadius: '0.45rem',
                          padding: '0.85rem 1rem',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '1rem',
                          transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          onClose();
                          onNavigate(alert.link);
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '0.35rem',
                              backgroundColor: priorityBg,
                              color: priorityColor,
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                              marginTop: 2
                            }}
                          >
                            <IconComponent size={18} />
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                              <span
                                style={{
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '999px',
                                  backgroundColor: priorityBg,
                                  color: priorityColor,
                                  letterSpacing: '0.04em'
                                }}
                              >
                                {alert.priority}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted, #64748b)', fontWeight: 600 }}>
                                {alert.categoryLabel}
                              </span>
                              {alert.time && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted, #94a3b8)', marginLeft: 'auto' }}>
                                  {alert.time}
                                </span>
                              )}
                            </div>

                            <h6
                              style={{
                                fontSize: '0.88rem',
                                fontWeight: 700,
                                margin: '0 0 0.2rem',
                                color: 'var(--clr-text-primary, #0f172a)'
                              }}
                            >
                              {alert.title}
                            </h6>
                            <p
                              style={{
                                fontSize: '0.79rem',
                                margin: 0,
                                color: 'var(--clr-text-secondary, #475569)',
                                lineHeight: 1.4
                              }}
                            >
                              {alert.message}
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            style={{
                              fontSize: '0.74rem',
                              padding: '0.3rem 0.7rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              borderRadius: '0.35rem'
                            }}
                            onClick={e => {
                              e.stopPropagation();
                              onClose();
                              onNavigate(alert.link);
                            }}
                          >
                            <span>Open</span>
                            <ArrowRight size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            style={{
                              fontSize: '0.74rem',
                              padding: '0.3rem 0.55rem',
                              display: 'flex',
                              alignItems: 'center',
                              borderRadius: '0.35rem'
                            }}
                            onClick={e => {
                              e.stopPropagation();
                              onDismissAlert(alert.id);
                            }}
                            title="Delete this notification"
                            aria-label="Delete notification"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="modal-footer py-2 px-4"
              style={{
                borderTop: '1px solid var(--clr-border, #e2e8f0)',
                backgroundColor: 'var(--clr-bg-card, #f8fafc)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span style={{ fontSize: '0.76rem', color: 'var(--clr-text-muted, #64748b)' }}>
                Showing <strong>{filteredNotifications.length}</strong> of <strong>{notifications.length}</strong> alerts
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onClose}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.9rem', borderRadius: '0.35rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

