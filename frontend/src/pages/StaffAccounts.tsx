import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import type { UserProfile, UserRole } from '../types';
import {
  Users,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  Search,
  Trash2,
  UserX,
  UserCheck,
  Key,
} from 'lucide-react';
import { firstError, validateEmail, validatePassword, validateRequired, validateTextLength, sanitizeInput } from '../utils/validation';
import ConfirmModal from '../components/ConfirmModal';
import './Patients.css';
import './StaffAccounts.css';

const ROLE_PRESETS: Record<UserRole, { title: string; dept: string; tone: string }> = {
  admin: { title: 'Administrator', dept: 'Administration', tone: 'primary' },
  receptionist: { title: 'Receptionist', dept: 'Admissions & Records', tone: 'info' },
  opd: { title: 'OPD Physician', dept: 'Outpatient (OPD)', tone: 'success' },
  emergency: { title: 'Emergency Specialist', dept: 'Emergency (ER)', tone: 'danger' },
  pharmacy: { title: 'Pharmacist', dept: 'Pharmacy', tone: 'purple' },
  laboratory: { title: 'Lab Technologist', dept: 'Laboratory', tone: 'warning' },
};

export default function StaffAccounts() {
  const {
    currentUser,
    fetchStaffList,
    createStaffAccount,
    updateStaffStatus,
    resetStaffPassword,
    deleteStaffAccount,
  } = useAuth();

  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Toasts / alerts
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Create Staff Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('receptionist');
  const [formRoleTitle, setFormRoleTitle] = useState(ROLE_PRESETS.receptionist.title);
  const [formDept, setFormDept] = useState(ROLE_PRESETS.receptionist.dept);
  const [formEmail, setFormEmail] = useState('');

  // Password Reset Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteTargetUser, setDeleteTargetUser] = useState<UserProfile | null>(null);
  const [deletingStaff, setDeletingStaff] = useState(false);

  // Status toggle state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const users = await fetchStaffList();
      setStaffList(users);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [fetchStaffList]);

  const handleRoleChange = (role: UserRole) => {
    setFormRole(role);
    setFormRoleTitle(ROLE_PRESETS[role].title);
    setFormDept(ROLE_PRESETS[role].dept);
    if (!formEmail && formUsername) {
      setFormEmail(`${formUsername.trim().toLowerCase()}@boru.edu.et`);
    }
  };

  const handleUsernameChange = (val: string) => {
    setFormUsername(val);
    const cleaned = val.trim().toLowerCase();
    if (cleaned) {
      setFormEmail(`${cleaned}@boru.edu.et`);
    }
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const validationErrors = validateRequired(
      { name: formName, username: formUsername, password: formPassword, role: formRole },
      { name: 'Name', username: 'Username', password: 'Password', role: 'Role' },
    );
    const validationError = firstError(
      ...Object.values(validationErrors),
      validateTextLength(formName, 'Name', { min: 2, max: 150, required: true }),
      validateTextLength(formUsername, 'Username', { min: 3, max: 60, required: true }),
      validatePassword(formPassword),
      formEmail ? validateEmail(formEmail) : undefined,
    );
    if (validationError) {
      setCreateError(validationError);
      return;
    }
    setIsSubmitting(true);

    try {
      const res = await createStaffAccount({
        name: sanitizeInput(formName),
        username: sanitizeInput(formUsername).toLowerCase(),
        password: formPassword.trim(),
        role: formRole,
        roleTitle: sanitizeInput(formRoleTitle) || ROLE_PRESETS[formRole].title,
        department: sanitizeInput(formDept) || ROLE_PRESETS[formRole].dept,
        email: sanitizeInput(formEmail) || `${sanitizeInput(formUsername).toLowerCase()}@boru.edu.et`,
      });

      if (res.success && res.user) {
        setToastMessage({
          text: `Account created for ${res.user.name}.`,
          type: 'success',
        });
        setShowCreateModal(false);
        setFormName('');
        setFormUsername('');
        setFormPassword('');
        setFormEmail('');
        await loadData();
      } else {
        setCreateError(res.error || 'Failed to create staff account');
      }
    } catch {
      setCreateError('Could not communicate with the database');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    if (user.id === currentUser?.id) {
      setToastMessage({ text: 'You cannot deactivate your own account', type: 'error' });
      return;
    }

    setTogglingId(user.id);
    const nextStatus = user.isActive === false ? true : false;

    try {
      const res = await updateStaffStatus(user.id, nextStatus);
      if (res.success) {
        setToastMessage({
          text: `${user.name} is now ${nextStatus ? 'active' : 'inactive'}.`,
          type: 'success',
        });
        await loadData();
      } else {
        setToastMessage({ text: res.error || 'Failed to update status', type: 'error' });
      }
    } catch {
      setToastMessage({ text: 'Error updating account status', type: 'error' });
    } finally {
      setTogglingId(null);
    }
  };

  const handleOpenResetModal = (user: UserProfile) => {
    setResetTargetUser(user);
    setNewPassword('');
    setResetError(null);
    setShowResetModal(true);
  };

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    setResetError(null);
    const validationError = firstError(
      ...Object.values(validateRequired({ newPassword }, { newPassword: 'New password' })),
      validatePassword(newPassword, 'New password'),
    );
    if (validationError) {
      setResetError(validationError);
      return;
    }
    setResetting(true);

    try {
      const res = await resetStaffPassword(resetTargetUser.id, newPassword);
      if (res.success) {
        setToastMessage({
          text: `Password updated for ${resetTargetUser.name}.`,
          type: 'success',
        });
        setShowResetModal(false);
      } else {
        setResetError(res.error || 'Failed to reset password');
      }
    } catch {
      setResetError('Error connecting to authentication service');
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteStaff = (user: UserProfile) => {
    if (user.id === currentUser?.id) {
      setToastMessage({ text: 'You cannot delete your own account', type: 'error' });
      return;
    }
    setDeleteTargetUser(user);
  };

  const confirmDeleteStaff = async () => {
    if (!deleteTargetUser) return;
    setDeletingStaff(true);
    try {
      const res = await deleteStaffAccount(deleteTargetUser.id);
      if (res.success) {
        setToastMessage({ text: `Staff account removed for ${deleteTargetUser.name}.`, type: 'success' });
        await loadData();
      } else {
        setToastMessage({ text: res.error || 'Failed to delete account', type: 'error' });
      }
    } catch {
      setToastMessage({ text: 'Error deleting account', type: 'error' });
    } finally {
      setDeletingStaff(false);
      setDeleteTargetUser(null);
    }
  };

  // Filtered accounts
  const filteredUsers = staffList.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const activeCount = staffList.filter(u => u.isActive !== false).length;
  const inactiveCount = staffList.length - activeCount;
  const roleCount = Object.keys(ROLE_PRESETS).length;

  const summaryCards = [
    { label: 'Total Staff', value: staffList.length, tone: 'info', icon: Users },
    { label: 'Active', value: activeCount, tone: 'success', icon: UserCheck },
    { label: 'Inactive', value: inactiveCount, tone: 'danger', icon: UserX },
    { label: 'Roles', value: `${roleCount} Units`, tone: 'primary', icon: ShieldCheck },
  ] as const;

  return (
    <div className="staff-accounts-page" style={{ width: '100%' }}>
      {/* ── Page Header matching Patients.tsx ── */}
      <div className="page-header mb-3">
        <div>
          <h1 className="page-title">
            <Users size={26} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
            Staff Accounts
          </h1>
          <p className="page-subtitle">{staffList.length} registered staff members across 6 operational units</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          id="add-staff-btn"
          onClick={() => {
            setCreateError(null);
            setShowCreateModal(true);
          }}
        >
          <UserPlus size={16} /> Add Staff Account
        </button>
      </div>

      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div
          className={`alert ${toastMessage.type === 'success' ? 'alert-success' : 'alert-danger'} alert-dismissible py-2 px-3`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span style={{ fontWeight: 600 }}>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            className="close"
            onClick={() => setToastMessage(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Summary Row ── */}
      <div className="row staff-summary-row mb-3">
        {summaryCards.map(({ label, value, tone, icon: Icon }) => (
          <div className="col-12 col-sm-6 col-xl-3 mb-3 mb-xl-0" key={label}>
            <div className="info-box staff-summary-card shadow-sm h-100">
              <span className={`info-box-icon bg-${tone}`}>
                <Icon size={32} strokeWidth={2.1} aria-hidden="true" />
              </span>
              <div className="info-box-content">
                <span className="info-box-text">{label}</span>
                <span className="info-box-number">{value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters Bar matching Patients.tsx ── */}
      <div className="filters-bar mb-3">
        <div className="search-bar" style={{ flex: '1 1 240px', maxWidth: 360 }}>
          <Search size={16} className="icon" />
          <input
            id="staff-search"
            placeholder="Search by name, username, department…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="pill-tabs">
          {[
            { id: 'all', label: 'All Roles' },
            { id: 'admin', label: 'Admin' },
            { id: 'receptionist', label: 'Receptionist' },
            { id: 'opd', label: 'OPD' },
            { id: 'emergency', label: 'Emergency' },
            { id: 'pharmacy', label: 'Pharmacy' },
            { id: 'laboratory', label: 'Laboratory' },
          ].map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={`pill-tab ${roleFilter === tab.id ? 'active' : ''}`}
              onClick={() => setRoleFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table matching Patients.tsx ── */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Staff Member</th>
              <th>Username</th>
              <th>Role</th>
              <th>Department</th>
              <th>Email</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--clr-text-muted)' }}>
                  Loading staff directory...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--clr-text-muted)' }}>
                  No staff accounts found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const preset = ROLE_PRESETS[user.role] || { tone: 'primary' };
                const isSelf = user.id === currentUser?.id || user.username === currentUser?.username;
                const isActive = user.isActive !== false;
                const initials = user.avatarInitials ||
                  user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'ST';

                const badgeToneClass =
                  preset.tone === 'info' ? 'badge-blue' :
                  preset.tone === 'danger' ? 'badge-red' :
                  preset.tone === 'success' ? 'badge-green' :
                  preset.tone === 'warning' ? 'badge-amber' :
                  preset.tone === 'purple' ? 'badge-violet' : 'badge-blue';

                return (
                  <tr key={user.id || user.username} style={{ opacity: isActive ? 1 : 0.65 }}>
                    <td>
                      <div className="patient-cell">
                        <div
                          className="avatar"
                          style={{
                            background: user.badgeColor || 'var(--clr-primary-500)',
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            color: '#fff',
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </div>
                        <div>
                          <div className="patient-name">
                            {user.name}
                            {isSelf && (
                              <span className="badge badge-blue" style={{ fontSize: '0.62rem', marginLeft: '0.4rem', padding: '1px 5px' }}>
                                You
                              </span>
                            )}
                          </div>
                          <div className="patient-sub">{user.roleTitle || user.role}</div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <code className="id-code">@{user.username}</code>
                    </td>

                    <td>
                      <span className={`badge ${badgeToneClass}`}>
                        {user.role.toUpperCase()}
                      </span>
                    </td>

                    <td>{user.department || '—'}</td>
                    <td>{user.email || '—'}</td>

                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(user)}
                        disabled={togglingId === user.id || isSelf}
                        className={`badge ${isActive ? 'badge-green' : 'badge-gray'}`}
                        title={isSelf ? 'Cannot deactivate self' : (isActive ? 'Click to deactivate' : 'Click to activate')}
                        style={{ cursor: isSelf ? 'not-allowed' : 'pointer', border: 'none', padding: '0.2rem 0.55rem' }}
                      >
                        {isActive ? <UserCheck size={11} /> : <UserX size={11} />}
                        <span>{isActive ? 'Active' : 'Inactive'}</span>
                      </button>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-icon"
                          title="Reset Password"
                          onClick={() => handleOpenResetModal(user)}
                        >
                          <Key size={14} />
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-icon"
                          title={isActive ? 'Deactivate Account' : 'Activate Account'}
                          disabled={isSelf || togglingId === user.id}
                          onClick={() => handleToggleStatus(user)}
                        >
                          {isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>

                        {!isSelf && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm btn-icon"
                            title="Delete Account"
                            onClick={() => handleDeleteStaff(user)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── MODAL 1: CREATE STAFF ACCOUNT (Compact Modal) ── */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div
            className="modal"
            style={{ maxWidth: 460, padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header pb-2 mb-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--clr-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.95rem' }}>
                <UserPlus size={16} className="text-primary" /> New Staff Account
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              {createError && (
                <div className="alert alert-danger py-1 px-2 mb-2" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem' }}>
                  <AlertCircle size={14} />
                  <span>{createError}</span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Amanuel Wario"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    style={{ height: 32, fontSize: '0.8rem', padding: '0 0.55rem' }}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Username *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. drbikila"
                      value={formUsername}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      style={{ height: 32, fontSize: '0.8rem', padding: '0 0.55rem' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="Initial password"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      style={{ height: 32, fontSize: '0.8rem', padding: '0 0.55rem' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Role *</label>
                  <select
                    value={formRole}
                    onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                    style={{ height: 32, fontSize: '0.8rem', padding: '0 0.55rem' }}
                  >
                    <option value="receptionist">Receptionist (Admissions)</option>
                    <option value="opd">OPD Physician</option>
                    <option value="emergency">Emergency Specialist</option>
                    <option value="pharmacy">Pharmacist</option>
                    <option value="laboratory">Lab Technologist</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Role Title</label>
                    <input
                      type="text"
                      value={formRoleTitle}
                      onChange={(e) => setFormRoleTitle(e.target.value)}
                      style={{ height: 32, fontSize: '0.8rem', padding: '0 0.55rem' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Department</label>
                    <input
                      type="text"
                      value={formDept}
                      onChange={(e) => setFormDept(e.target.value)}
                      style={{ height: 32, fontSize: '0.8rem', padding: '0 0.55rem' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Email</label>
                  <input
                    type="email"
                    placeholder="staff@boru.edu.et"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    style={{ height: 32, fontSize: '0.8rem', padding: '0 0.55rem' }}
                  />
                </div>
              </div>

              <div className="modal-footer pt-2 mt-3" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.45rem', borderTop: '1px solid var(--clr-border)' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                  style={{ height: 30, fontSize: '0.78rem', padding: '0 0.75rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isSubmitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', height: 30, fontSize: '0.78rem', padding: '0 0.75rem' }}
                >
                  <Lock size={13} />
                  <span>{isSubmitting ? 'Saving...' : 'Save Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: RESET PASSWORD MODAL (Compact Modal) ── */}
      {showResetModal && resetTargetUser && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div
            className="modal"
            style={{ maxWidth: 360, padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header pb-2 mb-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--clr-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.95rem' }}>
                <Key size={15} className="text-warning" /> Reset Password
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowResetModal(false)}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleResetSubmit}>
              {resetError && (
                <div className="alert alert-danger py-1 px-2 mb-2" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem' }}>
                  <AlertCircle size={14} />
                  <span>{resetError}</span>
                </div>
              )}

              <p style={{ fontSize: '0.78rem', color: 'var(--clr-text-secondary)', marginBottom: '0.75rem' }}>
                Enter new password for <strong>{resetTargetUser.username}</strong> ({resetTargetUser.name}).
              </p>

              <div className="form-group mb-0">
                <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>New Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Min. 4 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ height: 32, fontSize: '0.8rem', padding: '0 0.55rem' }}
                />
              </div>

              <div className="modal-footer pt-2 mt-3" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.45rem', borderTop: '1px solid var(--clr-border)' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowResetModal(false)}
                  disabled={resetting}
                  style={{ height: 30, fontSize: '0.78rem', padding: '0 0.75rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-warning btn-sm"
                  disabled={resetting}
                  style={{ height: 30, fontSize: '0.78rem', padding: '0 0.75rem', fontWeight: 600 }}
                >
                  {resetting ? 'Resetting...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Staff Account Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetUser)}
        title="Delete Staff Account"
        message={`Are you sure you want to delete the staff account for "${deleteTargetUser?.name}" (${deleteTargetUser?.username})? This user will lose access immediately.`}
        confirmText="Delete Account"
        variant="danger"
        icon="trash"
        isLoading={deletingStaff}
        onClose={() => setDeleteTargetUser(null)}
        onConfirm={confirmDeleteStaff}
      />
    </div>
  );
}
