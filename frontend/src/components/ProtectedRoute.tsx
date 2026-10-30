/**
 * BruClinic — Role-Based Route Guard
 *
 * Usage:
 *   <ProtectedRoute allowed={['admin', 'receptionist']}>
 *     <SomePage />
 *   </ProtectedRoute>
 *
 * If the current user's role is not in `allowed`, they are redirected to their
 * own landing page instead of seeing a 403 error or an unrelated page.
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  /** Roles that may access this route. An empty array means "no one". */
  allowed: UserRole[];
  children: React.ReactNode;
}

/** Maps each role to its home landing page (mirrors getRoleLandingPage in App.tsx). */
export function roleLandingPage(role: UserRole | undefined): string {
  switch (role) {
    case 'admin':        return '/admin';
    case 'receptionist': return '/reception';
    case 'opd':          return '/opd';
    case 'emergency':    return '/emergency';
    case 'pharmacy':     return '/pharmacy-board';
    case 'laboratory':   return '/laboratory';
    default:             return '/';
  }
}

export default function ProtectedRoute({ allowed, children }: ProtectedRouteProps) {
  const { currentUser } = useAuth();
  const role = currentUser?.role;

  if (!role || !allowed.includes(role)) {
    return <Navigate to={roleLandingPage(role)} replace />;
  }

  return <>{children}</>;
}

