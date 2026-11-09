import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { CreateStaffInput, UserProfile, UserRole } from '../types';
import { apiDelete, apiGet, apiPatch, apiPost } from '../api/client';

interface AuthResponse { success: boolean; error?: string; message?: string; user?: UserProfile; }
interface ActionResponse { success: boolean; error?: string; message?: string; }

interface AuthContextType {
  currentUser: UserProfile | null;
  token: string | null;
  role: UserRole;
  isAuthenticated: boolean;
  authLoading: boolean;
  idleLockMinutes: number;
  login: (username: string, password?: string) => Promise<AuthResponse>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<ActionResponse>;
  unlockSession: (password: string) => Promise<ActionResponse>;
  createStaffAccount: (data: CreateStaffInput) => Promise<AuthResponse>;
  fetchStaffList: () => Promise<UserProfile[]>;
  updateStaffStatus: (userId: string, isActive: boolean) => Promise<ActionResponse>;
  resetStaffPassword: (userId: string, newPassword?: string, autoGenerate?: boolean, useDefaultPassword?: boolean) => Promise<ActionResponse & { generatedPassword?: string }>;
  deleteStaffAccount: (userId: string) => Promise<ActionResponse>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const STORAGE_USER_KEY = 'bruclinic_active_user';
const STORAGE_TOKEN_KEY = 'bruclinic_active_token';

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'The authentication service is unavailable.';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_TOKEN_KEY));
  const [authLoading, setAuthLoading] = useState(true);
  const [idleLockMinutes, setIdleLockMinutes] = useState(15);

  const clearSession = useCallback(() => {
    setCurrentUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem('bruclinic:session_locked');
    localStorage.removeItem('bruclinic:last_activity');
  }, []);

  useEffect(() => {
    if (!token) {
      setAuthLoading(false);
      return;
    }
    setAuthLoading(true);
    apiGet<{ user: UserProfile; idleLockMinutes?: number }>('/auth/me', token)
      .then(response => {
        setCurrentUser(response.user);
        if (response.idleLockMinutes) {
          setIdleLockMinutes(response.idleLockMinutes);
          localStorage.setItem('bruclinic:idle_lock_minutes', String(response.idleLockMinutes));
        }
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(response.user));
      })
      .catch(() => clearSession())
      .finally(() => setAuthLoading(false));
  }, [token, clearSession]);

  useEffect(() => {
    if (token) localStorage.setItem(STORAGE_TOKEN_KEY, token);
  }, [token]);

  const login = useCallback(async (username: string, password = ''): Promise<AuthResponse> => {
    const cleanUsername = username.trim();
    if (!cleanUsername || !password) return { success: false, error: 'Please enter both username and password.' };
    try {
      const response = await apiPost<{ token: string; user: UserProfile; idleLockMinutes?: number }>('/auth/login', { username: cleanUsername, password });
      setToken(response.token);
      setCurrentUser(response.user);
      if (response.idleLockMinutes) {
        setIdleLockMinutes(response.idleLockMinutes);
        localStorage.setItem('bruclinic:idle_lock_minutes', String(response.idleLockMinutes));
      }
      localStorage.setItem('bruclinic:last_activity', String(Date.now()));
      localStorage.removeItem('bruclinic:session_locked');
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(response.user));
      return { success: true, user: response.user };
    } catch (error) {
      return { success: false, error: messageFrom(error) };
    }
  }, []);

  const logout = useCallback(() => clearSession(), [clearSession]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<ActionResponse> => {
    try {
      const response = await apiPost<{ message: string }>('/auth/change-password', { currentPassword, newPassword }, token);
      setCurrentUser(user => user ? { ...user, mustChangePassword: false } : user);
      return { success: true, message: response.message };
    } catch (error) {
      return { success: false, error: messageFrom(error) };
    }
  }, [token]);

  const unlockSession = useCallback(async (password: string): Promise<ActionResponse> => {
    try {
      const response = await apiPost<{ message: string }>('/auth/unlock', { password }, token);
      return { success: true, message: response.message };
    } catch (error) {
      return { success: false, error: messageFrom(error) };
    }
  }, [token]);

  const createStaffAccount = useCallback(async (data: CreateStaffInput): Promise<AuthResponse> => {
    try {
      const response = await apiPost<{ user: UserProfile; message: string }>('/auth/create-user', data, token);
      return { success: true, user: response.user, message: response.message };
    } catch (error) {
      return { success: false, error: messageFrom(error) };
    }
  }, [token]);

  const fetchStaffList = useCallback(async () => {
    const response = await apiGet<{ data: UserProfile[] }>('/auth/users', token);
    return response.data;
  }, [token]);

  const updateStaffStatus = useCallback(async (userId: string, isActive: boolean): Promise<ActionResponse> => {
    try {
      const response = await apiPatch<{ message: string }>('/auth/users/' + encodeURIComponent(userId) + '/status', { isActive }, token);
      return { success: true, message: response.message };
    } catch (error) {
      return { success: false, error: messageFrom(error) };
    }
  }, [token]);

  const resetStaffPassword = useCallback(async (userId: string, newPassword?: string, autoGenerate = false, useDefaultPassword = false): Promise<ActionResponse & { generatedPassword?: string }> => {
    try {
      const response = await apiPost<{ message: string; generatedPassword?: string }>('/auth/users/' + encodeURIComponent(userId) + '/reset-password', { newPassword, autoGenerate, useDefaultPassword }, token);
      return { success: true, message: response.message, generatedPassword: response.generatedPassword };
    } catch (error) {
      return { success: false, error: messageFrom(error) };
    }
  }, [token]);

  const deleteStaffAccount = useCallback(async (userId: string): Promise<ActionResponse> => {
    try {
      const response = await apiDelete<{ message: string }>('/auth/users/' + encodeURIComponent(userId), token);
      return { success: true, message: response.message };
    } catch (error) {
      return { success: false, error: messageFrom(error) };
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{
      currentUser, token, role: currentUser?.role || 'admin', isAuthenticated: Boolean(currentUser), authLoading, idleLockMinutes,
      login, logout, changePassword, unlockSession, createStaffAccount, fetchStaffList, updateStaffStatus, resetStaffPassword, deleteStaffAccount,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
