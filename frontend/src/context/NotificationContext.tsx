import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import {
  HeartPulse, Pill, FlaskConical, AlertTriangle, Users, Stethoscope, type LucideIcon
} from 'lucide-react';
import { useClinic } from './ClinicContext';
import { useAuth } from './AuthContext';

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
  markAlertsRead: (key?: string) => void;
  refreshClinicData: () => Promise<void>;
  loading: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentUser, role } = useAuth();
  const { erCases, labOrders, medicines, pharmacyOrders, queue, refresh, loading } = useClinic();

  const dismissedStorageKey = `bruclinic:dismissed_alerts_${currentUser?.id || 'guest'}`;
  const readAlertStorageKey = `bruclinic:read_alert_key_${currentUser?.id || 'guest'}`;

  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(dismissedStorageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [readAlertKey, setReadAlertKey] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(readAlertStorageKey) || '';
    } catch {
      return '';
    }
  });

  // Re-sync storage keys if user account changes
  useEffect(() => {
    try {
      const storedDismissed = localStorage.getItem(dismissedStorageKey);
      setDismissedAlertIds(storedDismissed ? JSON.parse(storedDismissed) : []);
    } catch {
      setDismissedAlertIds([]);
    }

    try {
      const storedRead = localStorage.getItem(readAlertStorageKey);
      setReadAlertKey(storedRead || '');
    } catch {
      setReadAlertKey('');
    }
  }, [dismissedStorageKey, readAlertStorageKey]);

  // Generate department-filtered alerts based on staff role
  const roleNotifications = useMemo<ClinicAlert[]>(() => {
    const alerts: ClinicAlert[] = [];

    // 1. Emergency Department: Red & Yellow acuity cases
    if (['admin', 'emergency', 'opd'].includes(role)) {
      erCases.filter(c => c.acuity === 'Red').forEach(c => {
        alerts.push({
          id: `er-red-${c.id}`,
          category: 'er',
          categoryLabel: 'Emergency (ER)',
          priority: 'critical',
          title: `Code Red ER: ${c.patientName}`,
          message: `${c.chiefComplaint || 'Acute resuscitation'} · Red Acuity`,
          time: c.arrivalTime || 'Now',
          link: '/emergency',
          icon: HeartPulse,
        });
      });
    }

    if (['admin', 'emergency'].includes(role)) {
      erCases.filter(c => c.acuity === 'Yellow').forEach(c => {
        alerts.push({
          id: `er-yellow-${c.id}`,
          category: 'er',
          categoryLabel: 'Emergency (ER)',
          priority: 'urgent',
          title: `Urgent ER: ${c.patientName}`,
          message: `${c.chiefComplaint || 'Needs assessment'} · Yellow Acuity`,
          time: c.arrivalTime || 'Recent',
          link: '/emergency',
          icon: AlertTriangle,
        });
      });
    }

    // 2. OPD Queue: Waiting patients for clinician
    if (role === 'opd') {
      const myDoctorQueue = queue.filter(q =>
        q.stage === 'Doctor Consultation' &&
        (!q.assignedDoctorId || q.assignedDoctorId === currentUser?.id)
      );
      myDoctorQueue.forEach(q => {
        alerts.push({
          id: `opd-queue-${q.id}`,
          category: 'queue',
          categoryLabel: 'OPD Queue',
          priority: q.priority === 'Emergency' ? 'critical' : q.priority === 'Urgent' ? 'urgent' : 'normal',
          title: `Waiting Consultation: ${q.patientName} (Token #${q.tokenNumber})`,
          message: `${q.chiefComplaint || 'Consultation queue'} · Stage: ${q.stage}`,
          time: q.registeredTime || 'Today',
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
          time: q.registeredTime || 'Today',
          link: '/opd',
          icon: Users,
        });
      });
    }

    // 3. Laboratory: Abnormal results and pending orders
    if (['admin', 'laboratory', 'opd'].includes(role)) {
      labOrders.filter(l => l.status === 'Completed' && l.isAbnormal).forEach(l => {
        alerts.push({
          id: `lab-abnormal-${l.id}`,
          category: 'lab',
          categoryLabel: 'Laboratory',
          priority: 'critical',
          title: `Abnormal Lab: ${l.patientName}`,
          message: `${l.testName}: ${l.result || 'Flagged clinically abnormal'}`,
          time: l.completedAt || 'Recently',
          link: role === 'opd' ? '/opd' : '/laboratory',
          icon: FlaskConical,
        });
      });
    }

    if (role === 'opd') {
      labOrders.filter(l => l.status === 'Completed' && !l.isAbnormal).forEach(l => {
        alerts.push({
          id: `lab-ready-${l.id}`,
          category: 'lab',
          categoryLabel: 'Laboratory',
          priority: 'normal',
          title: `Lab Ready: ${l.patientName} (${l.testName})`,
          message: `Result: ${l.result ? `${l.result}${l.unit ? ' ' + l.unit : ''}` : 'Completed'} · Ordered by ${l.doctorName || 'Clinician'}`,
          time: l.completedAt || 'Recently',
          link: '/opd',
          icon: FlaskConical,
        });
      });
    }

    if (['laboratory', 'admin'].includes(role)) {
      labOrders.filter(l => l.status !== 'Completed').forEach(l => {
        alerts.push({
          id: `lab-pending-${l.id}`,
          category: 'lab',
          categoryLabel: 'Laboratory',
          priority: 'urgent',
          title: `Order to Process: ${l.testName}`,
          message: `Patient: ${l.patientName} · Prescribed by: ${l.doctorName || 'Clinician'}`,
          time: 'Pending test',
          link: '/laboratory',
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
          time: q.registeredTime || 'Today',
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
          time: q.registeredTime || 'Today',
          link: '/reception',
          icon: AlertTriangle,
        });
      });
    }

    return alerts;
  }, [erCases, labOrders, medicines, pharmacyOrders, queue, role, currentUser?.id]);

  const visibleNotifications = useMemo(() => {
    return roleNotifications.filter(item => !dismissedAlertIds.includes(item.id));
  }, [roleNotifications, dismissedAlertIds]);

  const totalAlerts = visibleNotifications.length;
  const currentAlertKey = useMemo(() => {
    return JSON.stringify(visibleNotifications.map(item => item.id).sort());
  }, [visibleNotifications]);

  const unreadAlerts = currentAlertKey === readAlertKey ? 0 : totalAlerts;

  const markAlertsRead = (keyToMark?: string) => {
    const key = keyToMark ?? currentAlertKey;
    setReadAlertKey(key);
    try {
      localStorage.setItem(readAlertStorageKey, key);
    } catch {}
  };

  const dismissAlert = (id: string) => {
    setDismissedAlertIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem(dismissedStorageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const clearAllAlerts = () => {
    const allIds = roleNotifications.map(n => n.id);
    setDismissedAlertIds(prev => {
      const next = Array.from(new Set([...prev, ...allIds]));
      try {
        localStorage.setItem(dismissedStorageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
    markAlertsRead('');
  };

  const restoreAlert = (id: string) => {
    setDismissedAlertIds(prev => {
      const next = prev.filter(x => x !== id);
      try {
        localStorage.setItem(dismissedStorageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const restoreAllAlerts = () => {
    setDismissedAlertIds([]);
    try {
      localStorage.removeItem(dismissedStorageKey);
    } catch {}
  };

  const refreshClinicData = async () => {
    await refresh({ silent: false });
  };

  return (
    <NotificationContext.Provider
      value={{
        roleNotifications,
        visibleNotifications,
        dismissedAlertIds,
        totalAlerts,
        unreadAlerts,
        dismissAlert,
        clearAllAlerts,
        restoreAlert,
        restoreAllAlerts,
        markAlertsRead,
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
