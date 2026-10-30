/**
 * BruClinic — Role & Permission Constants
 * Single source of truth for all role-based access definitions.
 * All role checks across the system must reference these constants.
 */

/** Canonical list of all system roles. */
export const ROLES = Object.freeze({
  ADMIN: 'admin',
  RECEPTIONIST: 'receptionist',
  OPD: 'opd',
  EMERGENCY: 'emergency',
  PHARMACY: 'pharmacy',
  LABORATORY: 'laboratory',
});

/** All valid role strings as an array (for validation). */
export const ALL_ROLES = Object.values(ROLES);

/** Roles that can access admin-only routes. */
export const ADMIN_ROLES = Object.freeze([ROLES.ADMIN]);

/** Roles that can access clinical data. */
export const CLINICAL_ROLES = Object.freeze([ROLES.OPD, ROLES.EMERGENCY]);

/** Human-readable display names for each role. */
export const ROLE_LABELS = Object.freeze({
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.RECEPTIONIST]: 'Receptionist',
  [ROLES.OPD]: 'OPD Physician',
  [ROLES.EMERGENCY]: 'Emergency Specialist',
  [ROLES.PHARMACY]: 'Pharmacist',
  [ROLES.LABORATORY]: 'Lab Technologist',
});

/** Default department assignments per role. */
export const ROLE_DEPARTMENTS = Object.freeze({
  [ROLES.ADMIN]: 'Clinic Administration',
  [ROLES.RECEPTIONIST]: 'Admissions & Records',
  [ROLES.OPD]: 'Outpatient (OPD)',
  [ROLES.EMERGENCY]: 'Emergency (ER)',
  [ROLES.PHARMACY]: 'Pharmacy',
  [ROLES.LABORATORY]: 'Laboratory',
});

/** Badge colors for UI rendering per role. */
export const ROLE_BADGE_COLORS = Object.freeze({
  [ROLES.ADMIN]: '#2563eb',
  [ROLES.RECEPTIONIST]: '#0284c7',
  [ROLES.OPD]: '#10b981',
  [ROLES.EMERGENCY]: '#ef4444',
  [ROLES.PHARMACY]: '#8b5cf6',
  [ROLES.LABORATORY]: '#f59e0b',
});

/**
 * Resource-level access control map.
 * Maps resource → HTTP method → allowed roles[].
 * Referenced by the resource handler to enforce RBAC.
 */
export const RESOURCE_ACCESS = Object.freeze({
  patients: {
    GET: ALL_ROLES,
    POST: [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.OPD, ROLES.EMERGENCY],
    PATCH: [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.OPD, ROLES.EMERGENCY],
    DELETE: [ROLES.ADMIN],
  },
  doctors: {
    GET: ALL_ROLES,
    POST: [ROLES.ADMIN, ROLES.OPD],
    PATCH: [ROLES.ADMIN, ROLES.OPD],
    DELETE: [ROLES.ADMIN],
  },
  appointments: {
    GET: [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.OPD],
    POST: [ROLES.ADMIN, ROLES.RECEPTIONIST],
    PATCH: [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.OPD],
    DELETE: [ROLES.ADMIN, ROLES.RECEPTIONIST],
  },
  records: {
    GET: [ROLES.ADMIN, ROLES.OPD, ROLES.EMERGENCY, ROLES.LABORATORY],
    POST: [ROLES.ADMIN, ROLES.OPD, ROLES.EMERGENCY],
    PATCH: [ROLES.ADMIN, ROLES.OPD, ROLES.EMERGENCY],
    DELETE: [ROLES.ADMIN],
  },
  medicines: {
    GET: [ROLES.ADMIN, ROLES.PHARMACY, ROLES.OPD, ROLES.EMERGENCY],
    POST: [ROLES.ADMIN, ROLES.PHARMACY],
    PATCH: [ROLES.ADMIN, ROLES.PHARMACY],
    DELETE: [ROLES.ADMIN],
  },
  queue: {
    GET: ALL_ROLES,
    POST: [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.OPD, ROLES.EMERGENCY],
    PATCH: ALL_ROLES,
    DELETE: [ROLES.ADMIN, ROLES.RECEPTIONIST],
  },
  emergency: {
    GET: [ROLES.ADMIN, ROLES.EMERGENCY, ROLES.OPD],
    POST: [ROLES.ADMIN, ROLES.EMERGENCY, ROLES.OPD],
    PATCH: [ROLES.ADMIN, ROLES.EMERGENCY, ROLES.OPD],
    DELETE: [ROLES.ADMIN],
  },
  labOrders: {
    GET: [ROLES.ADMIN, ROLES.OPD, ROLES.LABORATORY, ROLES.EMERGENCY],
    POST: [ROLES.ADMIN, ROLES.OPD, ROLES.EMERGENCY],
    PATCH: [ROLES.ADMIN, ROLES.LABORATORY, ROLES.OPD],
    DELETE: [ROLES.ADMIN],
  },
  pharmacyOrders: {
    GET: [ROLES.ADMIN, ROLES.OPD, ROLES.PHARMACY, ROLES.EMERGENCY],
    POST: [ROLES.ADMIN, ROLES.OPD, ROLES.EMERGENCY],
    PATCH: [ROLES.ADMIN, ROLES.PHARMACY],
    DELETE: [ROLES.ADMIN],
  },
});
