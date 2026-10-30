/**
 * BruClinic — Maintenance Mode Context
 *
 * Reads the public health endpoint so the app knows whether the clinic is in
 * maintenance before it renders any clinical screen. The state is refreshed
 * every 30 seconds, so staff are released automatically when maintenance ends.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiGet } from '../api/client';
import type { HealthStatus } from '../types';

export const DEFAULT_MAINTENANCE_MESSAGE =
  'The clinic system is being updated to serve you better. Clinical services will resume shortly.';

interface MaintenanceContextType {
  enabled: boolean;
  message: string;
  checking: boolean;
  refresh: () => Promise<void>;
}

const MaintenanceContext = createContext<MaintenanceContextType | null>(null);

export function MaintenanceProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MAINTENANCE_MESSAGE);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const health = await apiGet<HealthStatus>('/health', null);
      setEnabled(Boolean(health.maintenance?.enabled));
      setMessage(health.maintenance?.message?.trim() || DEFAULT_MAINTENANCE_MESSAGE);
    } catch {
      // API unreachable: keep the last known state rather than trapping staff
      // behind a maintenance screen because of a network blip.
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <MaintenanceContext.Provider value={{ enabled, message, checking, refresh }}>
      {children}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenance() {
  const context = useContext(MaintenanceContext);
  if (!context) throw new Error('useMaintenance must be used within MaintenanceProvider');
  return context;
}
