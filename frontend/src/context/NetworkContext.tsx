/**
 * BruClinic — Network Connectivity Context
 *
 * Tracks whether the browser can reach the clinic API. `navigator.onLine`
 * covers the obvious offline case; the API client also reports failed and
 * successful requests so a dropped connection is noticed even when the device
 * still believes it has a network.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';

interface NetworkContextType {
  online: boolean;
}

const NetworkContext = createContext<NetworkContextType | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleApiState = (event: Event) => {
      const reachable = (event as CustomEvent<boolean>).detail;
      if (typeof reachable === 'boolean') setOnline(reachable);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('bruclinic:network-state', handleApiState);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('bruclinic:network-state', handleApiState);
    };
  }, []);

  return <NetworkContext.Provider value={{ online }}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) throw new Error('useNetwork must be used within NetworkProvider');
  return context;
}
