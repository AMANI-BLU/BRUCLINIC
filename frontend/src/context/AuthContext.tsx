import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserRole, UserProfile } from '../types';

export const ACTOR_PROFILES: Record<UserRole, UserProfile> = {
  admin: {
    id: 'USR-001',
    username: 'admin',
    name: 'Dr. Amanuel Wario',
    role: 'admin',
    roleTitle: 'Medical Director & System Admin',
    department: 'Hospital Administration',
    avatarInitials: 'AW',
    badgeColor: '#3b82f6',
    email: 'amanuel.wario@boru.edu.et',
  },
  receptionist: {
    id: 'USR-002',
    username: 'reception',
    name: 'Chaltu Dida',
    role: 'receptionist',
    roleTitle: 'Card Room Registrar & Receptionist',
    department: 'Patient Admissions & Records',
    avatarInitials: 'CD',
    badgeColor: '#0ea5e9',
    email: 'chaltu.dida@boru.edu.et',
  },
  opd: {
    id: 'USR-003',
    username: 'opd',
    name: 'Dr. Bikila Negassa',
    role: 'opd',
    roleTitle: 'OPD Senior Physician (Dr. & Nurse Station)',
    department: 'Outpatient Department (OPD)',
    avatarInitials: 'BN',
    badgeColor: '#10b981',
    email: 'bikila.negassa@boru.edu.et',
  },
  emergency: {
    id: 'USR-004',
    username: 'emergency',
    name: 'Dr. Teshome Galgalo',
    role: 'emergency',
    roleTitle: 'Emergency Trauma Specialist',
    department: 'Emergency & Critical Care (ER)',
    avatarInitials: 'TG',
    badgeColor: '#ef4444',
    email: 'teshome.galgalo@boru.edu.et',
  },
  pharmacy: {
    id: 'USR-005',
    username: 'pharmacy',
    name: 'Pharm. Hawi Tadesse',
    role: 'pharmacy',
    roleTitle: 'Chief Clinical Pharmacist',
    department: 'Central Pharmacy & Dispensary',
    avatarInitials: 'HT',
    badgeColor: '#f59e0b',
    email: 'hawi.tadesse@boru.edu.et',
  },
  laboratory: {
    id: 'USR-006',
    username: 'lab',
    name: 'Lab Tech. Geda Boru',
    role: 'laboratory',
    roleTitle: 'Senior Laboratory Technologist',
    department: 'Clinical Pathology & Diagnostic Lab',
    avatarInitials: 'GB',
    badgeColor: '#8b5cf6',
    email: 'geda.boru@boru.edu.et',
  },
};

interface AuthContextType {
  currentUser: UserProfile | null;
  role: UserRole;
  isAuthenticated: boolean;
  login: (username: string, password?: string) => boolean;
  loginAsRole: (role: UserRole) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'bruclinic_active_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.role && ACTOR_PROFILES[parsed.role as UserRole]) {
          return ACTOR_PROFILES[parsed.role as UserRole];
        }
      }
    } catch {
      // fallback
    }
    // Default to admin for initial smooth experience
    return ACTOR_PROFILES.admin;
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [currentUser]);

  const login = useCallback((username: string, _password?: string): boolean => {
    const trimmed = username.trim().toLowerCase();
    // match by username or role key
    const foundRole = (Object.keys(ACTOR_PROFILES) as UserRole[]).find(
      r => ACTOR_PROFILES[r].username.toLowerCase() === trimmed || r.toLowerCase() === trimmed
    );
    if (foundRole) {
      setCurrentUser(ACTOR_PROFILES[foundRole]);
      return true;
    }
    // fallback if admin or any matching
    if (trimmed.includes('recep') || trimmed.includes('card')) {
      setCurrentUser(ACTOR_PROFILES.receptionist);
      return true;
    }
    if (trimmed.includes('doc') || trimmed.includes('nurse') || trimmed.includes('opd')) {
      setCurrentUser(ACTOR_PROFILES.opd);
      return true;
    }
    if (trimmed.includes('er') || trimmed.includes('emerg')) {
      setCurrentUser(ACTOR_PROFILES.emergency);
      return true;
    }
    if (trimmed.includes('pharm') || trimmed.includes('drug')) {
      setCurrentUser(ACTOR_PROFILES.pharmacy);
      return true;
    }
    if (trimmed.includes('lab')) {
      setCurrentUser(ACTOR_PROFILES.laboratory);
      return true;
    }
    // Default fallback to admin
    setCurrentUser(ACTOR_PROFILES.admin);
    return true;
  }, []);

  const loginAsRole = useCallback((role: UserRole) => {
    setCurrentUser(ACTOR_PROFILES[role]);
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
  }, []);

  const switchRole = useCallback((role: UserRole) => {
    setCurrentUser(ACTOR_PROFILES[role]);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role: currentUser?.role || 'admin',
        isAuthenticated: !!currentUser,
        login,
        loginAsRole,
        logout,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
