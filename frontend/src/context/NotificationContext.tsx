import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import {
  HeartPulse, Pill, FlaskConical, AlertTriangle, Users, Stethoscope, Lock, ShieldAlert, type LucideIcon
} from 'lucide-react';
import { useClinic } from './ClinicContext';
import { useAuth } from './AuthContext';
import { formatTime12 } from '../utils/date';
import { apiGet } from '../api/client';
import type { LabOrder, SecurityEvent } from '../types';
import { normalizeDoctorName } from '../utils/doctorName';

export interface ClinicAlert {
  id: string;
  category: 'er' | 'pharmacy' | 'lab' | 'queue' | 'stock' | 'security';
  categoryLabel: string;
  priority: 'critical' | 'urgent' | 'normal';
  title: string;
  message: string;
  time?: string;
  link: string;
  icon: LucideIcon;
}

interface NotificationContextType {
  roleNotifications: ClinicAlert[];
  visibleNotifications: ClinicAlert[];
  dismissedAlertIds: string[];
  totalAlerts: number;
  unreadAlerts: number;
  dismissAlert: (id: string) => void;
  clearAllAlerts: () => void;
  restoreAlert: (id: string) => void;
  restoreAllAlerts: () => void;
  markAlertsRead: () => void;
  markAlertRead: (id: string) => void;
  refreshClinicData: () => Promise<void>;
  loading: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const GLOBAL_DISMISSED_KEY = 'bruclinic:dismissed_alerts_shared';
const GLOBAL_READ_KEY = 'bruclinic:read_alert_ids_shared';

function readStoredAlertIds(storageKey: string, fallbackKey?: string, sharedKey?: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const userStored = localStorage.getItem(storageKey) || (fallbackKey ? localStorage.getItem(fallbackKey) : null);
    const sharedStored = sharedKey ? localStorage.getItem(sharedKey) : null;
    const userIds = userStored ? JSON.parse(userStored) : [];
    const sharedIds = sharedStored ? JSON.parse(sharedStored) : [];
    const set = new Set<string>();
    if (Array.isArray(userIds)) userIds.forEach(id => set.add(String(id)));
    if (Array.isArray(sharedIds)) sharedIds.forEach(id => set.add(String(id)));
    return Array.from(set);
  } catch {
    return [];
  }
}

function saveAlertIds(storageKey: string, ids: string[], sharedKey?: string) {
  try {
    const trimmed = ids.slice(-500);
    localStorage.setItem(storageKey, JSON.stringify(trimmed));
    if (sharedKey) {
      const sharedStored = localStorage.getItem(sharedKey);
      const sharedParsed = sharedStored ? JSON.parse(sharedStored) : [];
      const set = new Set<string>();
      if (Array.isArray(sharedParsed)) sharedParsed.forEach(id => set.add(String(id)));
      trimmed.forEach(id => set.add(String(id)));
      localStorage.setItem(sharedKey, JSON.stringify(Array.from(set).slice(-500)));
    }
  } catch {}
}

function groupLabOrders(orders: LabOrder[]) {
  const groups = new Map<string, LabOrder[]>();
  orders.forEach(order => {
    const key = order.requestGroupId || order.queueItemId || order.id;
    const group = groups.get(key) || [];
    group.push(order);
    groups.set(key, group);
  });
  return [...groups.entries()].map(([key, groupOrders]) => ({
    key,
    orders: groupOrders,
    patientName: groupOrders[0]?.patientName || 'Patient',
    doctorName: normalizeDoctorName(groupOrders[0]?.doctorName) || 'Clinician',
  }));
}

function formatSecurityTitle(e: SecurityEvent): string {
  if (e.event_type === 'SECURITY_IP_BANNED' || e.description?.toLowerCase().includes('banned ip')) {
    return `Banned IP Blocked: ${e.ip_address || 'IP'}`;
  }
  switch (e.event_type) {
    case 'AUTH_LOGIN_LOCKED':     return `Account Locked: ${e.username ?? 'user'}`;
    case 'ACCOUNT_DELETED':       return `Account Deleted: ${e.username ?? 'user'}`;
    case 'ACCOUNT_DEACTIVATED':   return `Account Deactivated: ${e.username ?? 'user'}`;
    case 'ACCOUNT_UNLOCKED':      return `Account Unlocked: ${e.username ?? 'user'}`;
    case 'ACCOUNT_CREATED':       return `Account Created: ${e.username ?? 'user'}`;
    case 'AUTHZ_ROLE_ESCALATION': return `Role Escalation: ${e.username ?? 'user'}`;
    case 'AUTHZ_ACCESS_DENIED':   return `Access Denied: ${e.username ?? 'user'}`;
    default: return e.event_type?.replace(/_/g, ' ') ?? 'Security Event';
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentUser, role, token } = useAuth();
  const { erCases, labOrders, medicines, pharmacyOrders, queue, refresh, loading } = useClinic();

  const dismissedStorageKey = `bruclinic:dismissed_alerts_${currentUser?.id || 'guest'}`;
  const readAlertStorageKey = `bruclinic:read_alert_ids_${currentUser?.id || 'guest'}`;
  const legacyReadAlertStorageKey = `bruclinic:read_alert_key_${currentUser?.id || 'guest'}`;

  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>(() =>
    readStoredAlertIds(dismissedStorageKey, undefined, GLOBAL_DISMISSED_KEY),
  );

  const [readAlertIds, setReadAlertIds] = useState<string[]>(() =>
    readStoredAlertIds(readAlertStorageKey, legacyReadAlertStorageKey, GLOBAL_READ_KEY),
  );
  const [pendingMarkRead, setPendingMarkRead] = useState(false);

  // ── ICT / Admin: security event alerts fetched from API ──────────────────
  const [securityAlerts, setSecurityAlerts] = useState<ClinicAlert[]>([]);

  useEffect(() => {
    if (role !== 'ict' && role !== 'admin') { setSecurityAlerts([]); return; }
    if (!token) return;

    const WATCHED_EVENTS = [
      'AUTH_LOGIN_LOCKED',
      'ACCOUNT_DELETED',
      'ACCOUNT_DEACTIVATED',
      'ACCOUNT_UNLOCKED',
      'ACCOUNT_CREATED',
      'AUTHZ_ROLE_ESCALATION',
      'AUTHZ_ACCESS_DENIED',
      'SECURITY_IP_BANNED',
    ];

    const fetchSecurityAlerts = async () => {
      try {
        const res = await apiGet<{ data?: SecurityEvent[]; events?: SecurityEvent[] } | SecurityEvent[]>('/admin/security-events?limit=50', token);
        const events: SecurityEvent[] = Array.isArray(res)
          ? res
          : (res?.data ?? res?.events ?? []);

        const now = Date.now();
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        const userCreatedTime = currentUser?.createdAt ? new Date(currentUser.createdAt).getTime() : 0;
        const seenBannedIps = new Set<string>();

        const newAlerts: ClinicAlert[] = events
          .filter(e => {
            const eventType = e.event_type ?? '';
            if (!WATCHED_EVENTS.includes(eventType)) return false;
            if (e.created_at) {
              const eventTime = new Date(e.created_at).getTime();
              // Live alerts are strictly for recent events within 24 hours
              if (!isNaN(eventTime) && now - eventTime > ONE_DAY_MS) return false;
              // If account was created within the last 24h, do not backfill events that occurred prior to creation
              if (userCreatedTime && !isNaN(userCreatedTime) && eventTime < userCreatedTime - 30_000) {
                return false;
              }
            }
            // Consolidate repeated blocks from the same banned IP into 1 single notification
            const isBannedIpEvent = eventType === 'SECURITY_IP_BANNED' || e.description?.toLowerCase().includes('banned ip');
            if (isBannedIpEvent) {
              const ipKey = e.ip_address || 'unknown';
              if (seenBannedIps.has(ipKey)) return false;
              seenBannedIps.add(ipKey);
            }
            return true;
          })
          .map(e => {
            const isBannedIpEvent = e.event_type === 'SECURITY_IP_BANNED' || e.description?.toLowerCase().includes('banned ip');
            return {
              id: isBannedIpEvent ? `sec-banned-ip-${e.ip_address || e.id || 'unknown'}` : `sec-${e.id || e.event_type || 'event'}`,
              category: 'security' as const,
              categoryLabel: 'Security',
              priority: (e.severity === 'critical' ? 'critical' : e.severity === 'warning' ? 'urgent' : 'normal') as 'critical' | 'urgent' | 'normal',
              title: formatSecurityTitle(e),
              message: isBannedIpEvent ? `Blocked connection attempts from banned IP: ${e.ip_address || 'device'}` : (e.description ?? e.event_type ?? 'Security event'),
              time: e.created_at ? new Date(e.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : undefined,
              link: '/security',
              icon: isBannedIpEvent ? ShieldAlert : (e.event_type === 'AUTH_LOGIN_LOCKED' ? Lock : ShieldAlert),
            };
          });
        setSecurityAlerts(newAlerts);
      } catch {
        // Silently ignore — security events are supplementary
      }
    };

    fetchSecurityAlerts();
    const id = window.setInterval(fetchSecurityAlerts, 90_000);
    return () => clearInterval(id);
  }, [role, token, currentUser?.createdAt]);

  // Re-sync storage keys if user account changes or signs in
  useEffect(() => {
    try {
      setDismissedAlertIds(readStoredAlertIds(dismissedStorageKey, undefined, GLOBAL_DISMISSED_KEY));
      setReadAlertIds(readStoredAlertIds(readAlertStorageKey, legacyReadAlertStorageKey, GLOBAL_READ_KEY));
    } catch {
      setDismissedAlertIds([]);
      setReadAlertIds([]);
    }
  }, [dismissedStorageKey, readAlertStorageKey, legacyReadAlertStorageKey]);

  // Generate department-filtered alerts based on staff role
  const roleNotifications = useMemo<ClinicAlert[]>(() => {
    const alerts: ClinicAlert[] = [];

    const sameStaffName = (value?: string) => {
      if (!value || !currentUser?.name) return false;
      const clean = (input: string) => input.replace(/^(dr\.?|doctor)\s+/i, '').trim().toLowerCase();
      return clean(value) === clean(currentUser.name);
    };
    const emergencyCaseBelongsToUser = (caseItem: { attendingDoctorId?: string; attendingDoctor?: string }) =>
      role === 'admin' || caseItem.attendingDoctorId === currentUser?.id || sameStaffName(caseItem.attendingDoctor);
    const labOrderBelongsToUser = (order: { doctorId?: string; doctorName?: string }) =>
      role !== 'opd' || order.doctorId === currentUser?.id || sameStaffName(order.doctorName);

    // 1. Emergency Department: Red & Yellow acuity cases
    if (role === 'emergency') {
      erCases.filter(c => c.acuity === 'Red' && emergencyCaseBelongsToUser(c)).forEach(c => {
        alerts.push({
          id: `er-red-${c.id}`,
          category: 'er',
          categoryLabel: 'Emergency (ER)',
          priority: 'critical',
          title: `Code Red ER: ${c.patientName}`,
          message: `${c.chiefComplaint || 'Acute resuscitation'} · Red Acuity`,
          time: formatTime12(c.arrivalTime || 'Now'),
          link: '/emergency',
          icon: HeartPulse,
        });
      });
    }

    if (role === 'emergency') {
      erCases.filter(c => c.acuity === 'Yellow' && emergencyCaseBelongsToUser(c)).forEach(c => {
        alerts.push({
          id: `er-yellow-${c.id}`,
          category: 'er',
          categoryLabel: 'Emergency (ER)',
          priority: 'urgent',
          title: `Urgent ER: ${c.patientName}`,
          message: `${c.chiefComplaint || 'Needs assessment'} · Yellow Acuity`,
          time: formatTime12(c.arrivalTime || 'Recent'),
          link: '/emergency',
          icon: AlertTriangle,
        });
      });
    }

    // 2. OPD Queue: Waiting patients for clinician
    if (role === 'opd') {
      const myDoctorQueue = queue.filter(q =>
        q.stage === 'Doctor Consultation' &&
        (q.assignedDoctorId === currentUser?.id || sameStaffName(q.assignedDoctorName))
      );
      myDoctorQueue.forEach(q => {
        alerts.push({
          id: `opd-queue-${q.id}`,
          category: 'queue',
          categoryLabel: 'OPD Queue',
          priority: q.priority === 'Emergency' ? 'critical' : q.priority === 'Urgent' ? 'urgent' : 'normal',
          title: `Waiting Consultation: ${q.patientName} (Token #${q.tokenNumber})`,
          message: `${q.chiefComplaint || 'Consultation queue'} · Stage: ${q.stage}`,
          time: formatTime12(q.registeredTime || 'Today'),
          link: '/opd',
          icon: Stethoscope,
        });
      });
    } else if (role === 'admin') {
      const urgentQueue = queue.filter(q => q.priority === 'Emergency' || q.priority === 'Urgent');
      urgentQueue.forEach(q => {
        alerts.push({
          id: `admin-queue-${q.id}`,
          category: 'queue',
          categoryLabel: 'Queue Priority',
          priority: q.priority === 'Emergency' ? 'critical' : 'urgent',
          title: `Priority Queue: ${q.patientName} (Token #${q.tokenNumber})`,
          message: `${q.priority} priority arrival · ${q.chiefComplaint || 'Requires doctor review'}`,
          time: formatTime12(q.registeredTime || 'Today'),
          link: '/opd',
          icon: Users,
        });
      });
    }

    // 3. Laboratory: keep notifications at the request-form level, even when
    // a form contains many individual investigations.
    const labGroups = groupLabOrders(labOrders.filter(labOrderBelongsToUser));

    if (['admin', 'laboratory'].includes(role)) {
      labGroups.forEach(group => {
        const pending = group.orders.filter(order => order.status !== 'Completed');
        const abnormal = group.orders.filter(order => order.status === 'Completed' && order.isAbnormal);
        if (!pending.length && !abnormal.length) return;
        const completedCount = group.orders.length - pending.length;
        const statusSummary = [
          pending.length ? `Pending: ${pending.map(order => order.testName).join(', ')}` : '',
          abnormal.length ? `Abnormal: ${abnormal.map(order => `${order.testName} (${order.result || 'flagged'})`).join(', ')}` : '',
          pending.length && completedCount ? `${completedCount}/${group.orders.length} tests reported` : '',
          `From ${group.doctorName}`,
        ].filter(Boolean).join(' · ');
        alerts.push({
          id: `lab-form-${group.key}`,
          category: 'lab',
          categoryLabel: 'Laboratory',
          priority: abnormal.length ? 'critical' : 'urgent',
          title: pending.length
            ? `Lab form: ${group.patientName} (${pending.length} pending)`
            : `Abnormal lab results: ${group.patientName} (${abnormal.length})`,
          message: statusSummary,
          time: formatTime12(abnormal[0]?.completedAt || group.orders[0]?.orderedAt || 'Recently'),
          link: '/laboratory',
          icon: FlaskConical,
        });
      });
    }

    if (role === 'opd') {
      labGroups.forEach(group => {
        const completed = group.orders.filter(order => order.status === 'Completed');
        if (!completed.length) return;
        const abnormal = completed.some(order => order.isAbnormal);
        const pendingCount = group.orders.length - completed.length;
        alerts.push({
          id: `lab-results-${group.key}`,
          category: 'lab',
          categoryLabel: 'Laboratory',
          priority: abnormal ? 'critical' : 'normal',
          title: `${abnormal ? 'Abnormal lab results' : 'Lab results ready'}: ${group.patientName}`,
          message: `${completed.map(order => `${order.testName}: ${order.result || 'Completed'}${order.unit ? ` ${order.unit}` : ''}`).join(' · ')}${pendingCount ? ` · ${pendingCount} test${pendingCount === 1 ? '' : 's'} still pending` : ''}`,
          time: formatTime12(completed[0]?.completedAt || 'Recently'),
          link: '/opd',
          icon: FlaskConical,
        });
      });
    }

    // 4. Pharmacy: Pending orders to dispense & stock warnings
    if (['pharmacy', 'admin'].includes(role)) {
      pharmacyOrders.filter(p => p.status === 'Pending').forEach(p => {
        alerts.push({
          id: `rx-pending-${p.id}`,
          category: 'pharmacy',
          categoryLabel: 'Pharmacy',
          priority: 'urgent',
          title: `Pending Prescription: ${p.patientName}`,
          message: `Doctor: ${p.doctorName || 'Doctor'} · Order #${p.id}`,
          time: 'Pending dispense',
          link: '/pharmacy',
          icon: Pill,
        });
      });

      medicines.filter(m => m.stock <= m.minStock).forEach(m => {
        const isOut = m.stock === 0;
        alerts.push({
          id: `stock-${m.id}`,
          category: 'stock',
          categoryLabel: 'Pharmacy Stock',
          priority: isOut ? 'critical' : 'urgent',
          title: `${isOut ? 'Out of Stock' : 'Low Stock Warning'}: ${m.name}`,
          message: `${m.stock} ${m.unit || 'units'} left (Min: ${m.minStock})`,
          time: 'Inventory alert',
          link: '/pharmacy',
          icon: Pill,
        });
      });
    }

    // 5. Reception: Check-in, card creation, and urgent arrivals
    if (role === 'receptionist') {
      queue.filter(q => q.cardStatus === 'New Card' || q.hasExistingCard === false || q.stage === 'Reception').forEach(q => {
        alerts.push({
          id: `rec-card-${q.id}`,
          category: 'queue',
          categoryLabel: 'Reception & Cards',
          priority: q.priority === 'Emergency' ? 'critical' : 'normal',
          title: `Card Verification: ${q.patientName} (Token #${q.tokenNumber})`,
          message: `ID/Card assignment needed · Stage: ${q.stage}`,
          time: formatTime12(q.registeredTime || 'Today'),
          link: '/reception',
          icon: Users,
        });
      });

      queue.filter(q => q.priority === 'Emergency').forEach(q => {
        alerts.push({
          id: `rec-urg-${q.id}`,
          category: 'queue',
          categoryLabel: 'Reception Urgent',
          priority: 'critical',
          title: `Emergency Arrival: ${q.patientName}`,
          message: `Token #${q.tokenNumber} marked Emergency · Priority transfer needed`,
          time: formatTime12(q.registeredTime || 'Today'),
          link: '/reception',
          icon: AlertTriangle,
        });
      });
    }

    return alerts;
  }, [erCases, labOrders, medicines, pharmacyOrders, queue, role, currentUser?.id, currentUser?.name]);

  // Merge clinic alerts + security alerts (security alerts come from API fetch above)
  const allRoleNotifications = useMemo(() => {
    if (role === 'ict') {
      return securityAlerts;
    }
    return [...roleNotifications, ...securityAlerts];
  }, [role, roleNotifications, securityAlerts]);

  const visibleNotifications = useMemo(() => {
    return allRoleNotifications.filter(item => !dismissedAlertIds.includes(item.id));
  }, [allRoleNotifications, dismissedAlertIds]);

  const totalAlerts = visibleNotifications.length;
  const unreadAlerts = visibleNotifications.filter(item => !readAlertIds.includes(item.id)).length;

  const markAlertsRead = () => {
    // The notification menu can be opened while the first clinic refresh is still
    // running. Defer the read action until the final alert IDs are available so a
    // temporary empty list is never saved as the user's read state.
    if (loading) {
      setPendingMarkRead(true);
      return;
    }
    const visibleIds = visibleNotifications.map(item => item.id);
    if (!visibleIds.length) return;
    setReadAlertIds(previous => {
      const next = Array.from(new Set([...previous, ...visibleIds]));
      saveAlertIds(readAlertStorageKey, next, GLOBAL_READ_KEY);
      return next;
    });
    setPendingMarkRead(false);
  };

  const markAlertRead = (id: string) => {
    if (!id) return;
    setReadAlertIds(previous => {
      if (previous.includes(id)) return previous;
      const next = [...previous, id];
      saveAlertIds(readAlertStorageKey, next, GLOBAL_READ_KEY);
      return next;
    });
  };

  useEffect(() => {
    if (!pendingMarkRead || loading) return;
    if (!visibleNotifications.length) {
      setPendingMarkRead(false);
      return;
    }
    const visibleIds = visibleNotifications.map(item => item.id);
    setReadAlertIds(previous => {
      const next = Array.from(new Set([...previous, ...visibleIds]));
      saveAlertIds(readAlertStorageKey, next, GLOBAL_READ_KEY);
      return next;
    });
    setPendingMarkRead(false);
  }, [pendingMarkRead, loading, visibleNotifications, readAlertStorageKey]);

  const dismissAlert = (id: string) => {
    setDismissedAlertIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveAlertIds(dismissedStorageKey, next, GLOBAL_DISMISSED_KEY);
      return next;
    });
  };

  const clearAllAlerts = () => {
    const allIds = allRoleNotifications.map(n => n.id);
    setDismissedAlertIds(prev => {
      const next = Array.from(new Set([...prev, ...allIds]));
      saveAlertIds(dismissedStorageKey, next, GLOBAL_DISMISSED_KEY);
      return next;
    });
    setReadAlertIds(previous => {
      const next = Array.from(new Set([...previous, ...allIds]));
      saveAlertIds(readAlertStorageKey, next, GLOBAL_READ_KEY);
      return next;
    });
  };

  const restoreAlert = (id: string) => {
    setDismissedAlertIds(prev => {
      const next = prev.filter(x => x !== id);
      try {
        localStorage.setItem(dismissedStorageKey, JSON.stringify(next));
        const shared = localStorage.getItem(GLOBAL_DISMISSED_KEY);
        if (shared) {
          const parsed = JSON.parse(shared);
          if (Array.isArray(parsed)) {
            localStorage.setItem(GLOBAL_DISMISSED_KEY, JSON.stringify(parsed.filter((x: string) => x !== id)));
          }
        }
      } catch {}
      return next;
    });
  };

  const restoreAllAlerts = () => {
    setDismissedAlertIds([]);
    try {
      localStorage.removeItem(dismissedStorageKey);
      localStorage.removeItem(GLOBAL_DISMISSED_KEY);
    } catch {}
  };

  const refreshClinicData = async () => {
    await refresh({ silent: false });
  };

  return (
    <NotificationContext.Provider
      value={{
        roleNotifications: allRoleNotifications,
        visibleNotifications,
        dismissedAlertIds,
        totalAlerts,
        unreadAlerts,
        dismissAlert,
        clearAllAlerts,
        restoreAlert,
        restoreAllAlerts,
        markAlertsRead,
        markAlertRead,
        refreshClinicData,
        loading,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
