import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Search, CheckCircle2, ArrowRight, Trash2, CheckCheck,
  RotateCcw, AlertTriangle, HeartPulse
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import './Notifications.css';

export default function Notifications() {
  const navigate = useNavigate();
  const { currentUser, role } = useAuth();
  const {
    visibleNotifications,
    dismissedAlertIds,
    dismissAlert,
    clearAllAlerts,
    restoreAllAlerts,
    markAlertsRead,
    refreshClinicData,
    loading
  } = useNotifications();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'critical' | 'er' | 'pharmacy' | 'lab' | 'queue' | 'stock'>('all');
  const [selectedPriority, setSelectedPriority] = useState<'all' | 'critical' | 'urgent' | 'normal'>('all');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Compute category pill tabs with real counts
  const categories = useMemo(() => {
    const counts: Record<string, number> = { all: visibleNotifications.length };
    const criticalCount = visibleNotifications.filter(n => n.priority === 'critical').length;
    counts.critical = criticalCount;

    visibleNotifications.forEach(n => {
      counts[n.category] = (counts[n.category] || 0) + 1;
    });

    return [
      { id: 'all' as const, label: `All Alerts (${visibleNotifications.length})` },
      ...(criticalCount > 0 ? [{ id: 'critical' as const, label: `Critical (${criticalCount})` }] : []),
      ...(counts.er ? [{ id: 'er' as const, label: `Emergency (${counts.er})` }] : []),
      ...(counts.pharmacy ? [{ id: 'pharmacy' as const, label: `Pharmacy (${counts.pharmacy})` }] : []),
      ...(counts.stock ? [{ id: 'stock' as const, label: `Stock Warnings (${counts.stock})` }] : []),
      ...(counts.lab ? [{ id: 'lab' as const, label: `Laboratory (${counts.lab})` }] : []),
      ...(counts.queue ? [{ id: 'queue' as const, label: `Queue & OPD (${counts.queue})` }] : []),
    ];
  }, [visibleNotifications]);

  // Compute metrics
  const criticalCount = visibleNotifications.filter(n => n.priority === 'critical').length;
  const urgentCount = visibleNotifications.filter(n => n.priority === 'urgent').length;
  const normalCount = visibleNotifications.filter(n => n.priority === 'normal').length;

  // Filter list by category, priority, and search keyword
  const filteredNotifications = useMemo(() => {
    return visibleNotifications.filter(item => {
      if (selectedCategory === 'critical') {
        if (item.priority !== 'critical') return false;
      } else if (selectedCategory !== 'all') {
        if (item.category !== selectedCategory) return false;
      }

      if (selectedPriority !== 'all') {
        if (item.priority !== selectedPriority) return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.message.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q) ||
        (item.time && item.time.toLowerCase().includes(q))
      );
    });
  }, [visibleNotifications, selectedCategory, selectedPriority, searchQuery]);

  const handleClearAll = () => {
    setConfirmClearOpen(false);
    clearAllAlerts();
  };

  return (
    <div className="notif-page-container">
      {/* Page Header Card */}
      <div className="notif-header-card">
        <div className="notif-header-info">
          <div className="notif-header-icon-wrap">
            <Bell size={24} />
          </div>
          <div>
            <h1 className="notif-header-title">Notifications &amp; Live Alerts</h1>
            <p className="notif-header-sub">
              Real-time clinical signals and departmental queue updates for <strong>{currentUser?.roleTitle || role}</strong>
            </p>
          </div>
        </div>

        <div className="notif-header-actions">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
            onClick={() => void refreshClinicData()}
            disabled={loading}
            title="Refresh clinical data"
          >
            <RotateCcw size={14} className={loading ? 'fa-spin' : ''} />
            <span>Refresh</span>
          </button>

          {visibleNotifications.length > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
              onClick={() => markAlertsRead()}
              title="Mark all active alerts as read"
            >
              <CheckCheck size={14} />
              <span>Mark all read</span>
            </button>
          )}

          {visibleNotifications.length > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
              onClick={() => setConfirmClearOpen(true)}
              title="Clear all alerts from view"
            >
              <Trash2 size={14} />
              <span>Clear all</span>
            </button>
          )}

          {dismissedAlertIds.length > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-link text-decoration-none text-muted"
              style={{ fontSize: '0.8rem' }}
              onClick={restoreAllAlerts}
              title="Restore dismissed alerts"
            >
              Restore {dismissedAlertIds.length} dismissed
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="notif-kpi-grid">
        <div className="notif-kpi-card">
          <div className="notif-kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb' }}>
            <Bell size={20} />
          </div>
          <div>
            <div className="notif-kpi-val">{visibleNotifications.length}</div>
            <div className="notif-kpi-lbl">Total Active Alerts</div>
          </div>
        </div>

        <div className="notif-kpi-card">
          <div className="notif-kpi-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626' }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="notif-kpi-val" style={{ color: criticalCount > 0 ? '#dc2626' : undefined }}>
              {criticalCount}
            </div>
            <div className="notif-kpi-lbl">Critical Priority (Immediate)</div>
          </div>
        </div>

        <div className="notif-kpi-card">
          <div className="notif-kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706' }}>
            <HeartPulse size={20} />
          </div>
          <div>
            <div className="notif-kpi-val" style={{ color: urgentCount > 0 ? '#d97706' : undefined }}>
              {urgentCount}
            </div>
            <div className="notif-kpi-lbl">Urgent Clinical Tasks</div>
          </div>
        </div>

        <div className="notif-kpi-card">
          <div className="notif-kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="notif-kpi-val">{normalCount}</div>
            <div className="notif-kpi-lbl">Routine &amp; Waiting Queue</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="notif-filter-bar">
        <div className="notif-filter-top">
          <div className="notif-search-box">
            <Search size={15} className="notif-search-icon" />
            <input
              type="text"
              className="notif-search-input"
              placeholder="Search notifications by title, patient, or medicine..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="priority-select" style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)', fontWeight: 600 }}>
              Priority:
            </label>
            <select
              id="priority-select"
              className="form-select form-select-sm"
              style={{ width: 'auto', fontSize: '0.8rem' }}
              value={selectedPriority}
              onChange={e => setSelectedPriority(e.target.value as any)}
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical Only</option>
              <option value="urgent">Urgent Only</option>
              <option value="normal">Routine / Normal</option>
            </select>
          </div>
        </div>

        {/* Pill Category Tabs */}
        <div className="notif-pill-tabs">
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              className={`notif-pill-btn ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notification List or Empty State */}
      <div className="notif-list-container">
        {filteredNotifications.length === 0 ? (
          <div className="notif-empty-card">
            <div className="notif-empty-icon-wrap">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="notif-empty-title">
              {searchQuery.trim() || selectedCategory !== 'all' || selectedPriority !== 'all'
                ? 'No matching notifications found'
                : 'All caught up! No active alerts'}
            </h3>
            <p className="notif-empty-desc">
              {searchQuery.trim() || selectedCategory !== 'all' || selectedPriority !== 'all'
                ? 'Try adjusting your search query, priority selector, or category filters.'
                : `There are currently no active alerts requiring attention for ${currentUser?.roleTitle || role}. New notifications will appear automatically when emergencies or workflow orders arrive.`}
            </p>
            {dismissedAlertIds.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-outline-primary mt-2"
                onClick={restoreAllAlerts}
              >
                Restore {dismissedAlertIds.length} dismissed alerts
              </button>
            )}
          </div>
        ) : (
          filteredNotifications.map(alert => {
            const IconComponent = alert.icon || Bell;
            const isCritical = alert.priority === 'critical';
            const isUrgent = alert.priority === 'urgent';
            const iconBg = isCritical
              ? 'rgba(239, 68, 68, 0.12)'
              : isUrgent
              ? 'rgba(245, 158, 11, 0.12)'
              : 'rgba(59, 130, 246, 0.12)';
            const iconColor = isCritical ? '#dc2626' : isUrgent ? '#d97706' : '#2563eb';

            return (
              <div
                key={alert.id}
                className={`notif-card-item priority-${alert.priority}`}
              >
                <div className="notif-card-main">
                  <div className="notif-item-icon-box" style={{ background: iconBg, color: iconColor }}>
                    <IconComponent size={20} />
                  </div>

                  <div className="notif-card-body">
                    <div className="notif-card-body-head">
                      <span className="notif-card-title">{alert.title}</span>
                      <span className={`notif-badge-pill notif-badge-${alert.priority}`}>
                        {alert.priority}
                      </span>
                      <span className="badge text-bg-light border" style={{ fontSize: '0.68rem', fontWeight: 600 }}>
                        {alert.categoryLabel}
                      </span>
                    </div>

                    <p className="notif-card-msg">{alert.message}</p>

                    <div className="notif-card-meta">
                      {alert.time && <span>Time: <strong>{alert.time}</strong></span>}
                      <span>•</span>
                      <span>Target: {alert.link}</span>
                    </div>
                  </div>
                </div>

                <div className="notif-card-actions">
                  <button
                    type="button"
                    className="notif-btn-goto"
                    onClick={() => navigate(alert.link)}
                    title={`Go to ${alert.categoryLabel}`}
                  >
                    <span>View</span>
                    <ArrowRight size={14} />
                  </button>

                  <button
                    type="button"
                    className="notif-btn-dismiss"
                    onClick={() => dismissAlert(alert.id)}
                    title="Dismiss notification"
                    aria-label="Dismiss notification"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation modal before clearing all alerts */}
      <ConfirmModal
        isOpen={confirmClearOpen}
        title="Clear all active notifications?"
        message={`Are you sure you want to clear all ${visibleNotifications.length} active alerts? You can restore them later using the "Restore dismissed" button.`}
        confirmText="Yes, Clear All"
        cancelText="Cancel"
        variant="danger"
        icon="alert"
        compact
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={handleClearAll}
      />
    </div>
  );
}

