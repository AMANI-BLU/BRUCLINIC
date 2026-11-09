import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Search, CheckCircle2, ArrowRight, Trash2, CheckCheck,
  RotateCcw, AlertTriangle, HeartPulse, Clock
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
    const critical = visibleNotifications.filter(n => n.priority === 'critical').length;
    counts.critical = critical;

    visibleNotifications.forEach(n => {
      counts[n.category] = (counts[n.category] || 0) + 1;
    });

    return [
      { id: 'all' as const, label: `All Alerts (${visibleNotifications.length})` },
      ...(critical > 0 ? [{ id: 'critical' as const, label: `Critical (${critical})` }] : []),
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
            <Bell size={22} />
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

      {/* AdminLTE v3 Info Boxes Strip */}
      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="info-box shadow-sm mb-0">
            <span className="info-box-icon bg-primary elevation-1">
              <Bell size={20} />
            </span>
            <div className="info-box-content">
              <span className="info-box-text text-muted" style={{ fontSize: '0.82rem' }}>Total Active</span>
              <span className="info-box-number" style={{ fontSize: '1.4rem' }}>{visibleNotifications.length}</span>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="info-box shadow-sm mb-0">
            <span className="info-box-icon bg-danger elevation-1">
              <AlertTriangle size={20} />
            </span>
            <div className="info-box-content">
              <span className="info-box-text text-muted" style={{ fontSize: '0.82rem' }}>Critical Priority</span>
              <span className="info-box-number text-danger" style={{ fontSize: '1.4rem' }}>{criticalCount}</span>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="info-box shadow-sm mb-0">
            <span className="info-box-icon bg-warning elevation-1">
              <HeartPulse size={20} />
            </span>
            <div className="info-box-content">
              <span className="info-box-text text-muted" style={{ fontSize: '0.82rem' }}>Urgent Tasks</span>
              <span className="info-box-number text-warning-emphasis" style={{ fontSize: '1.4rem' }}>{urgentCount}</span>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="info-box shadow-sm mb-0">
            <span className="info-box-icon bg-success elevation-1">
              <CheckCircle2 size={20} />
            </span>
            <div className="info-box-content">
              <span className="info-box-text text-muted" style={{ fontSize: '0.82rem' }}>Routine Queue</span>
              <span className="info-box-number text-success" style={{ fontSize: '1.4rem' }}>{normalCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* AdminLTE v3 Filter Card */}
      <div className="card notif-filter-card shadow-sm mb-0">
        <div className="card-body p-3 d-flex flex-column gap-3">
          <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
            <div className="position-relative flex-grow-1" style={{ maxWidth: 460 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="form-control form-control-sm notif-search-input"
                style={{ paddingLeft: '2.25rem' }}
                placeholder="Search notifications by title, patient, or medicine..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="d-flex align-items-center gap-2">
              <label htmlFor="priority-select" className="m-0 text-muted small fw-bold">
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
          <div className="d-flex flex-wrap gap-2">
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
      </div>

      {/* AdminLTE v3 Main Card: Notifications List */}
      <div className="card card-outline card-primary shadow-sm mb-0">
        <div className="card-header py-2 px-3 d-flex align-items-center justify-content-between">
          <h3 className="card-title m-0 fw-bold d-flex align-items-center gap-2" style={{ fontSize: '0.95rem' }}>
            <Bell size={16} className="text-primary" />
            <span>Active Alerts</span>
            <span className="badge text-bg-primary rounded-pill">{filteredNotifications.length}</span>
          </h3>
          <span className="text-muted small">
            Filtered by: <strong>{selectedCategory === 'all' ? 'All categories' : selectedCategory}</strong>
          </span>
        </div>

        <div className="card-body p-0">
          {filteredNotifications.length === 0 ? (
            <div className="notif-empty-state">
              <div className="notif-empty-icon-wrap">
                <CheckCircle2 size={30} />
              </div>
              <h5 className="m-0 fw-bold">
                {searchQuery.trim() || selectedCategory !== 'all' || selectedPriority !== 'all'
                  ? 'No matching notifications found'
                  : 'All caught up! No active alerts'}
              </h5>
              <p className="text-muted small m-0" style={{ maxWidth: 440 }}>
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
            <div>
              {filteredNotifications.map(alert => {
                const IconComponent = alert.icon || Bell;
                const isCritical = alert.priority === 'critical';
                const isUrgent = alert.priority === 'urgent';
                const iconClass = isCritical ? 'icon-critical' : isUrgent ? 'icon-urgent' : 'icon-normal';

                return (
                  <div key={alert.id} className="notif-list-item">
                    <div className="notif-item-main">
                      <div className={`notif-icon-box ${iconClass}`}>
                        <IconComponent size={20} />
                      </div>

                      <div className="notif-item-body">
                        <div className="notif-item-head">
                          <span className="notif-item-title">{alert.title}</span>

                          {/* AdminLTE v3 Priority Badges */}
                          {isCritical && (
                            <span className="badge bg-danger" style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                              CRITICAL
                            </span>
                          )}
                          {isUrgent && (
                            <span className="badge bg-warning text-dark" style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                              URGENT
                            </span>
                          )}
                          {!isCritical && !isUrgent && (
                            <span className="badge bg-primary" style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                              NORMAL
                            </span>
                          )}

                          {/* Department Badge */}
                          <span className="badge bg-light text-dark border" style={{ fontSize: '0.68rem', fontWeight: 600 }}>
                            {alert.categoryLabel}
                          </span>
                        </div>

                        <p className="notif-item-msg">{alert.message}</p>

                        <div className="notif-item-meta">
                          {alert.time && (
                            <span className="d-inline-flex align-items-center gap-1">
                              <Clock size={12} />
                              <span>{alert.time}</span>
                            </span>
                          )}
                          <span>•</span>
                          <span>Destination: <code>{alert.link}</code></span>
                        </div>
                      </div>
                    </div>

                    <div className="notif-item-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1 shadow-sm"
                        onClick={() => navigate(alert.link)}
                        title={`Go to ${alert.categoryLabel}`}
                      >
                        <span>View</span>
                        <ArrowRight size={13} />
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center"
                        style={{ width: 32, height: 32, padding: 0 }}
                        onClick={() => dismissAlert(alert.id)}
                        title="Dismiss notification"
                        aria-label="Dismiss notification"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
