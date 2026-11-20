import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Gender, UserProfile, UserRole } from '../types';
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
  Unlock,
  Pencil,
} from 'lucide-react';
import { firstError, validateEmail, validateName, validateUsername, validatePassword, validatePhone, validateRequired, validateTextLength, sanitizeInput } from '../utils/validation';
import PhoneInput from '../components/AdminLTE/PhoneInput';
import { apiGet } from '../api/client';
import ConfirmModal from '../components/ConfirmModal';
import ModalPortal from '../components/ModalPortal';
import PasswordField from '../components/PasswordField';
import LoadingButton from '../components/LoadingButton';
import './Patients.css';
import './StaffAccounts.css';

const ROLE_PRESETS: Record<UserRole, { title: string; dept: string; tone: string }> = {
  admin: { title: 'Administrator', dept: 'Administration', tone: 'primary' },
  ict: { title: 'ICT Administrator', dept: 'Information & Communications Technology (ICT)', tone: 'info' },
  receptionist: { title: 'Receptionist', dept: 'Admissions & Records', tone: 'info' },
  opd: { title: 'OPD Physician', dept: 'Outpatient (OPD)', tone: 'success' },
  emergency: { title: 'Emergency Specialist', dept: 'Emergency (ER)', tone: 'danger' },
  pharmacy: { title: 'Pharmacist', dept: 'Pharmacy', tone: 'purple' },
  laboratory: { title: 'Lab Technologist', dept: 'Laboratory', tone: 'warning' },
};

type StaffEditForm = Pick<UserProfile, 'name' | 'username' | 'role' | 'roleTitle' | 'department' | 'email'> & {
  phone: string;
  gender: Gender;
};

export default function StaffAccounts() {
  const {
    currentUser,
    token,
    fetchStaffList,
    createStaffAccount,
    updateStaffAccount,
    updateStaffStatus,
    unlockStaffAccount,
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
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});
  const [createTouched, setCreateTouched] = useState<Record<string, boolean>>({});

  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('receptionist');
  const [formRoleTitle, setFormRoleTitle] = useState(ROLE_PRESETS.receptionist.title);
  const [formDept, setFormDept] = useState(ROLE_PRESETS.receptionist.dept);
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formGender, setFormGender] = useState<Gender>('Male');

  // Edit account dialog
  const [editTargetUser, setEditTargetUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState<StaffEditForm>({
    name: '', username: '', role: 'receptionist', roleTitle: '', department: '', email: '', phone: '', gender: 'Male',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});
  const [editTouched, setEditTouched] = useState<Record<string, boolean>>({});

  // Password Reset Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetMode, setResetMode] = useState<'default' | 'generate' | 'manual'>('default');
  const [defaultPasswordConfigured, setDefaultPasswordConfigured] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteTargetUser, setDeleteTargetUser] = useState<UserProfile | null>(null);
  const [deletingStaff, setDeletingStaff] = useState(false);

  // Status toggle state
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

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
      setFormEmail(`${formUsername.trim().toLowerCase()}@bru.edu.et`);
    }
  };

  const handleUsernameChange = (val: string) => {
    setFormUsername(val);
    const cleaned = val.trim().toLowerCase();
    if (cleaned) {
      setFormEmail(`${cleaned}@bru.edu.et`);
    }
    if (createTouched['formUsername']) validateCreateField('formUsername', val);
  };

  // Per-field validation helpers
  const validateCreateField = (name: string, value: string) => {
    let err: string | undefined;
    if (name === 'formName') err = validateName(value, 'Full Name');
    else if (name === 'formUsername') err = validateUsername(value, 'Username');
    else if (name === 'formEmail') err = value ? validateEmail(value, 'Email') : undefined;
    else if (name === 'formPhone') err = !value.trim() ? 'Phone number is required.' : validatePhone(value, 'Phone number');
    setCreateFieldErrors(prev => ({ ...prev, [name]: err ?? '' }));
  };

  const validateEditField = (name: string, value: string) => {
    let err: string | undefined;
    if (name === 'name') err = validateName(value, 'Full Name');
    else if (name === 'username') err = validateUsername(value, 'Username');
    else if (name === 'email') err = !value.trim() ? 'Email is required.' : validateEmail(value, 'Email');
    else if (name === 'phone') err = !value.trim() ? 'Phone number is required.' : validatePhone(value, 'Phone number');
    setEditFieldErrors(prev => ({ ...prev, [name]: err ?? '' }));
  };

  const createFieldClass = (name: string) => {
    if (!createTouched[name]) return '';
    return createFieldErrors[name] ? 'is-invalid' : 'is-valid';
  };

  const editFieldClass = (name: string) => {
    if (!editTouched[name]) return '';
    return editFieldErrors[name] ? 'is-invalid' : 'is-valid';
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setCreateError(null);
    // Mark all fields touched on submit
    setCreateTouched({ formName: true, formUsername: true, formEmail: true, formPhone: true });
    const validationErrors = validateRequired(
      { name: formName, username: formUsername, role: formRole },
      { name: 'Name', username: 'Username', role: 'Role' },
    );
    const validationError = firstError(
      ...Object.values(validationErrors),
      validateTextLength(formName, 'Name', { min: 2, max: 150, required: true }),
      validateTextLength(formUsername, 'Username', { min: 3, max: 60, required: true }),
      formEmail ? validateEmail(formEmail) : undefined,
      validateTextLength(formPhone, 'Phone number', { min: 8, max: 40, required: true }),
      validatePhone(formPhone, 'Phone number'),
    );
    if (validationError) {
      setCreateError(validationError);
      return;
    }
    if (currentUser?.role === 'ict' && formRole === 'admin') {
      setCreateError('ICT personnel are not permitted to create Administrator accounts.');
      return;
    }
    setIsSubmitting(true);

    try {
      const res = await createStaffAccount({
        name: sanitizeInput(formName),
        username: sanitizeInput(formUsername).toLowerCase(),
        role: formRole,
        roleTitle: sanitizeInput(formRoleTitle) || ROLE_PRESETS[formRole].title,
        department: sanitizeInput(formDept) || ROLE_PRESETS[formRole].dept,
        email: sanitizeInput(formEmail) || `${sanitizeInput(formUsername).toLowerCase()}@bru.edu.et`,
        phone: sanitizeInput(formPhone),
        gender: formGender,
      });

      if (res.success && res.user) {
        setToastMessage({
          text: `Account created for ${res.user.name}.`,
          type: 'success',
        });
        setShowCreateModal(false);
        setFormName('');
        setFormUsername('');
        setFormEmail('');
        setFormPhone('');
        setFormGender('Male');
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

  const handleOpenEdit = (user: UserProfile) => {
    if (currentUser?.role === 'ict' && user.role === 'admin') {
      setToastMessage({ text: 'ICT personnel cannot modify Administrator accounts.', type: 'error' });
      return;
    }
    setEditTargetUser(user);
    setEditForm({
      name: user.name,
      username: user.username,
      role: user.role,
      roleTitle: user.roleTitle || ROLE_PRESETS[user.role].title,
      department: user.department || ROLE_PRESETS[user.role].dept,
      email: user.email,
      phone: user.phone || '',
      gender: user.gender || 'Male',
    });
    setEditError(null);
    setEditFieldErrors({});
    setEditTouched({});
  };

  const handleEditSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editTargetUser || savingEdit) return;
    setEditError(null);
    // Mark all validated fields as touched on submit
    setEditTouched({ name: true, username: true, email: true, phone: true });
    const validationError = firstError(
      ...Object.values(validateRequired(
        { name: editForm.name, username: editForm.username, role: editForm.role, email: editForm.email, phone: editForm.phone },
        { name: 'Name', username: 'Username', role: 'Role', email: 'Email', phone: 'Phone number' },
      )),
      validateTextLength(editForm.name, 'Name', { min: 2, max: 150, required: true }),
      validateTextLength(editForm.username, 'Username', { min: 3, max: 60, required: true }),
      validateTextLength(editForm.roleTitle, 'Role title', { min: 1, max: 100, required: true }),
      validateTextLength(editForm.department, 'Department', { min: 1, max: 150, required: true }),
      validateTextLength(editForm.email, 'Email', { min: 3, max: 180, required: true }),
      validateEmail(editForm.email),
      validateTextLength(editForm.phone, 'Phone number', { min: 8, max: 40, required: true }),
      validatePhone(editForm.phone, 'Phone number'),
    );
    if (validationError) {
      setEditError(validationError);
      return;
    }

    if (currentUser?.role === 'ict' && (editTargetUser.role === 'admin' || editForm.role === 'admin')) {
      setEditError('ICT personnel are not permitted to modify Administrator accounts or assign the Administrator role.');
      return;
    }
    setSavingEdit(true);
    try {
      const result = await updateStaffAccount(editTargetUser.id, {
        name: sanitizeInput(editForm.name),
        username: sanitizeInput(editForm.username).toLowerCase(),
        role: editForm.role,
        roleTitle: sanitizeInput(editForm.roleTitle),
        department: sanitizeInput(editForm.department),
        email: sanitizeInput(editForm.email).toLowerCase(),
        phone: sanitizeInput(editForm.phone),
        gender: editForm.gender,
      });
      const savedUser = result.user;
      if (!result.success || !savedUser) {
        setEditError(result.error || 'Could not update this account.');
        return;
      }
      setStaffList(previous => previous.map(user => user.id === savedUser.id ? savedUser : user));
      setEditTargetUser(null);
      setToastMessage({ text: `Account updated for ${savedUser.name}.`, type: 'success' });
      await loadData();
    } catch {
      setEditError('Could not communicate with the account service.');
    } finally {
      setSavingEdit(false);
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

  const handleUnlockAccount = async (user: UserProfile) => {
    setUnlockingId(user.id);
    try {
      const res = await unlockStaffAccount(user.id);
      setToastMessage({
        text: res.success ? `Sign-in lock cleared for ${user.name}.` : (res.error || 'Could not unlock this account.'),
        type: res.success ? 'success' : 'error',
      });
    } catch {
      setToastMessage({ text: 'Could not unlock this account.', type: 'error' });
    } finally {
      setUnlockingId(null);
    }
  };

  const handleOpenResetModal = (user: UserProfile) => {
    setResetTargetUser(user);
    setNewPassword('');
    setResetMode('default');
    setDefaultPasswordConfigured(false);
    setGeneratedPassword('');
    setResetError(null);
    setShowResetModal(true);
    apiGet<{ configured: boolean }>('/admin/default-password', token)
      .then(result => {
        setDefaultPasswordConfigured(result.configured);
        setResetMode(result.configured ? 'default' : 'generate');
      })
      .catch(() => setResetMode('generate'));
  };

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    if (resetting) return;
    if (generatedPassword) {
      setShowResetModal(false);
      return;
    }
    setResetError(null);
    const validationError = resetMode === 'manual' ? firstError(
      ...Object.values(validateRequired({ newPassword }, { newPassword: 'New password' })),
      validatePassword(newPassword, 'New password'),
    ) : undefined;
    if (validationError) {
      setResetError(validationError);
      return;
    }
    setResetting(true);

    try {
      const res = await resetStaffPassword(
        resetTargetUser.id,
        newPassword,
        resetMode === 'generate',
        resetMode === 'default',
      );
      if (res.success) {
        setGeneratedPassword(res.generatedPassword || '');
        setToastMessage({
          text: `Password updated for ${resetTargetUser.name}.`,
          type: 'success',
        });
        if (!res.generatedPassword) setShowResetModal(false);
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
    if (currentUser?.role === 'ict' && user.role === 'admin') {
      setToastMessage({ text: 'ICT personnel cannot delete Administrator accounts', type: 'error' });
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
          <h1 className="page-title">Staff Accounts</h1>
          <p className="page-subtitle">{staffList.length} staff accounts</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          id="add-staff-btn"
          onClick={() => {
            setCreateError(null);
            setCreateFieldErrors({});
            setCreateTouched({});
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
            { id: 'ict', label: 'ICT' },
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
              <th>Phone</th>
              <th>Gender</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--clr-text-muted)' }}>
                  Loading staff directory...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr className="empty-state-row">
                <td colSpan={9}>
                  <div className="empty-state">
                    <div className="empty-state-icon tone-blue"><ShieldCheck size={28} /></div>
                    <h5 className="empty-state-title">No staff accounts found</h5>
                    <p className="empty-state-body">
                      No staff profiles match your search criteria or role filters. Provision a new user account using the button above.
                    </p>
                  </div>
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
                          className="avatar staff-account-avatar"
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
                          {user.avatarUrl && (
                            <img
                              src={user.avatarUrl}
                              alt={`${user.name} profile`}
                              onError={event => { event.currentTarget.style.display = 'none'; }}
                            />
                          )}
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
                    <td>{user.phone || '—'}</td>
                    <td>{user.gender || '—'}</td>

                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(user)}
                        disabled={togglingId === user.id || isSelf}
                        className={`badge ${isActive ? 'badge-green' : 'badge-gray'}`}
                        title={isSelf ? 'Cannot deactivate self' : (isActive ? 'Click to deactivate' : 'Click to activate')}
                        style={{ cursor: isSelf ? 'not-allowed' : 'pointer', border: 'none', padding: '0.2rem 0.55rem' }}
                      >
                        <span>{isActive ? 'Active' : 'Inactive'}</span>
                      </button>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-icon"
                          title={`Edit ${user.name}`}
                          aria-label={`Edit account for ${user.name}`}
                          onClick={() => handleOpenEdit(user)}
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-icon"
                          title="Reset Password"
                          onClick={() => handleOpenResetModal(user)}
                        >
                          <Key size={14} />
                        </button>

                        <LoadingButton
                          type="button"
                          className="btn btn-secondary btn-sm btn-icon"
                          title={isActive ? 'Unlock sign-in' : 'Activate the account before unlocking sign-in'}
                          aria-label={`Unlock sign-in for ${user.name}`}
                          disabled={!isActive || unlockingId === user.id}
                          onClick={() => handleUnlockAccount(user)}
                          loading={unlockingId === user.id}
                          loadingLabel=""
                        >
                          <Unlock size={14} />
                        </LoadingButton>

                        <LoadingButton
                          type="button"
                          className="btn btn-secondary btn-sm btn-icon"
                          title={isActive ? 'Deactivate Account' : 'Activate Account'}
                          disabled={isSelf || togglingId === user.id}
                          onClick={() => handleToggleStatus(user)}
                          loading={togglingId === user.id}
                          loadingLabel=""
                        >
                          {isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                        </LoadingButton>

                        {!isSelf && !(currentUser?.role === 'ict' && user.role === 'admin') && (
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
        <ModalPortal>
        <div className="modal-overlay" onClick={() => !isSubmitting && setShowCreateModal(false)}>
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
                disabled={isSubmitting}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} noValidate>
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
                    className={createFieldClass('formName')}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      if (createTouched['formName']) validateCreateField('formName', e.target.value);
                    }}
                    onBlur={(e) => { setCreateTouched(p => ({ ...p, formName: true })); validateCreateField('formName', e.target.value); }}
                  />
                  {createTouched['formName'] && createFieldErrors['formName'] && (
                    <div className="invalid-feedback">{createFieldErrors['formName']}</div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. drbikila"
                    value={formUsername}
                    className={createFieldClass('formUsername')}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    onBlur={(e) => { setCreateTouched(p => ({ ...p, formUsername: true })); validateCreateField('formUsername', e.target.value); }}
                  />
                  {createTouched['formUsername'] && createFieldErrors['formUsername'] && (
                    <div className="invalid-feedback">{createFieldErrors['formUsername']}</div>
                  )}
                </div>
                <div className="alert alert-info py-2 mb-0">The configured default staff password will be assigned. The user must change it at first sign-in.</div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Role *</label>
                  <select
                    value={formRole}
                    onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  >
                    <option value="receptionist">Receptionist (Admissions)</option>
                    <option value="opd">OPD Physician</option>
                    <option value="emergency">Emergency Specialist</option>
                    <option value="pharmacy">Pharmacist</option>
                    <option value="laboratory">Lab Technologist</option>
                    <option value="ict">ICT Administrator (System &amp; Accounts)</option>
                    {currentUser?.role !== 'ict' && <option value="admin">Administrator</option>}
                  </select>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Role Title</label>
                    <input
                      type="text"
                      value={formRoleTitle}
                      onChange={(e) => setFormRoleTitle(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Department</label>
                    <input
                      type="text"
                      value={formDept}
                      onChange={(e) => setFormDept(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Email</label>
                  <input
                    type="email"
                    placeholder="staff@bru.edu.et"
                    value={formEmail}
                    className={createFieldClass('formEmail')}
                    onChange={(e) => {
                      setFormEmail(e.target.value);
                      if (createTouched['formEmail']) validateCreateField('formEmail', e.target.value);
                    }}
                    onBlur={(e) => { setCreateTouched(p => ({ ...p, formEmail: true })); validateCreateField('formEmail', e.target.value); }}
                  />
                  {createTouched['formEmail'] && createFieldErrors['formEmail'] && (
                    <div className="invalid-feedback">{createFieldErrors['formEmail']}</div>
                  )}
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Phone number *</label>
                    <PhoneInput
                      id="create-staff-phone"
                      required
                      value={formPhone}
                      onChange={(val) => {
                        setFormPhone(val);
                        if (createTouched['formPhone']) validateCreateField('formPhone', val);
                      }}
                      onBlur={() => { setCreateTouched(p => ({ ...p, formPhone: true })); validateCreateField('formPhone', formPhone); }}
                      error={createTouched['formPhone'] ? createFieldErrors['formPhone'] : undefined}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>Gender *</label>
                    <select
                      required
                      value={formGender}
                      onChange={(e) => setFormGender(e.target.value as Gender)}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
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
                <LoadingButton
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isSubmitting}
                  loading={isSubmitting}
                  loadingLabel="Saving…"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', height: 30, fontSize: '0.78rem', padding: '0 0.75rem' }}
                >
                  <Lock size={13} />
                  <span>Save Account</span>
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── EDIT STAFF ACCOUNT ── */}
      {editTargetUser && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => !savingEdit && setEditTargetUser(null)}>
            <div
              className="modal"
              style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}
              onClick={event => event.stopPropagation()}
            >
              <div className="modal-header pb-2 mb-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--clr-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                  <Pencil size={16} className="text-primary" /> Edit Staff Account
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setEditTargetUser(null)}
                  disabled={savingEdit}
                  aria-label="Close dialog"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} noValidate>
                {editError && (
                  <div className="alert alert-danger py-2 px-2 mb-3" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem' }}>
                    <AlertCircle size={14} /> <span>{editError}</span>
                  </div>
                )}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Full name *</label>
                    <input
                      required
                      value={editForm.name}
                      className={editFieldClass('name')}
                      onChange={event => {
                        setEditForm(form => ({ ...form, name: event.target.value }));
                        if (editTouched['name']) validateEditField('name', event.target.value);
                      }}
                      onBlur={event => { setEditTouched(p => ({ ...p, name: true })); validateEditField('name', event.target.value); }}
                    />
                    {editTouched['name'] && editFieldErrors['name'] && (
                      <div className="invalid-feedback">{editFieldErrors['name']}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Username *</label>
                    <input
                      required
                      autoComplete="off"
                      value={editForm.username}
                      className={editFieldClass('username')}
                      onChange={event => {
                        setEditForm(form => ({ ...form, username: event.target.value }));
                        if (editTouched['username']) validateEditField('username', event.target.value);
                      }}
                      onBlur={event => { setEditTouched(p => ({ ...p, username: true })); validateEditField('username', event.target.value); }}
                    />
                    {editTouched['username'] && editFieldErrors['username'] && (
                      <div className="invalid-feedback">{editFieldErrors['username']}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select
                      value={editForm.role}
                      onChange={event => {
                        const role = event.target.value as UserRole;
                        const oldPreset = ROLE_PRESETS[editForm.role];
                        const newPreset = ROLE_PRESETS[role];
                        setEditForm(form => ({
                          ...form,
                          role,
                          roleTitle: form.roleTitle === oldPreset.title ? newPreset.title : form.roleTitle,
                          department: form.department === oldPreset.dept ? newPreset.dept : form.department,
                        }));
                      }}
                    >
                      {Object.entries(ROLE_PRESETS)
                        .filter(([role]) => currentUser?.role !== 'ict' || role !== 'admin')
                        .map(([role, preset]) => (
                          <option key={role} value={role}>{preset.title}</option>
                        ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role title *</label>
                    <input required value={editForm.roleTitle} onChange={event => setEditForm(form => ({ ...form, roleTitle: event.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department *</label>
                    <input required value={editForm.department} onChange={event => setEditForm(form => ({ ...form, department: event.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      required
                      value={editForm.email}
                      className={editFieldClass('email')}
                      onChange={event => {
                        setEditForm(form => ({ ...form, email: event.target.value }));
                        if (editTouched['email']) validateEditField('email', event.target.value);
                      }}
                      onBlur={event => { setEditTouched(p => ({ ...p, email: true })); validateEditField('email', event.target.value); }}
                    />
                    {editTouched['email'] && editFieldErrors['email'] && (
                      <div className="invalid-feedback">{editFieldErrors['email']}</div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone number *</label>
                    <PhoneInput
                      id="edit-staff-phone"
                      required
                      value={editForm.phone}
                      onChange={val => {
                        setEditForm(form => ({ ...form, phone: val }));
                        if (editTouched['phone']) validateEditField('phone', val);
                      }}
                      onBlur={() => { setEditTouched(p => ({ ...p, phone: true })); validateEditField('phone', editForm.phone); }}
                      error={editTouched['phone'] ? editFieldErrors['phone'] : undefined}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gender *</label>
                    <select value={editForm.gender || 'Male'} onChange={event => setEditForm(form => ({ ...form, gender: event.target.value as Gender }))}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer pt-3 mt-2" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--clr-border)' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditTargetUser(null)} disabled={savingEdit}>Cancel</button>
                  <LoadingButton type="submit" className="btn btn-primary btn-sm" loading={savingEdit} loadingLabel="Saving…" disabled={savingEdit}>
                    Save Changes
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ── MODAL 2: RESET PASSWORD MODAL (Compact Modal) ── */}
      {showResetModal && resetTargetUser && (
        <ModalPortal>
        <div className="modal-overlay" onClick={() => !resetting && setShowResetModal(false)}>
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
                disabled={resetting}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleResetSubmit} noValidate>
              {resetError && (
                <div className="alert alert-danger py-1 px-2 mb-2" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem' }}>
                  <AlertCircle size={14} />
                  <span>{resetError}</span>
                </div>
              )}

              <p style={{ fontSize: '0.78rem', color: 'var(--clr-text-secondary)', marginBottom: '0.75rem' }}>
                Reset password for <strong>{resetTargetUser.username}</strong> ({resetTargetUser.name}).
              </p>

              <fieldset className="staff-reset-options">
                <legend className="form-label staff-reset-legend">New password</legend>
                <label className={`staff-reset-option ${resetMode === 'default' ? 'is-selected' : ''} ${!defaultPasswordConfigured ? 'is-disabled' : ''}`}>
                  <input
                    className="staff-reset-radio"
                    type="radio"
                    name="reset-password-mode"
                    checked={resetMode === 'default'}
                    onChange={() => setResetMode('default')}
                    disabled={!defaultPasswordConfigured}
                  />
                  <span className="staff-reset-option-copy">
                    <strong>Clinic default password</strong>
                    {!defaultPasswordConfigured && <small>Not configured</small>}
                  </span>
                </label>
                <label className={`staff-reset-option ${resetMode === 'generate' ? 'is-selected' : ''}`}>
                  <input
                    className="staff-reset-radio"
                    type="radio"
                    name="reset-password-mode"
                    checked={resetMode === 'generate'}
                    onChange={() => setResetMode('generate')}
                  />
                  <span className="staff-reset-option-copy">
                    <strong>Generate temporary password</strong>
                    <small>Show it once after the reset.</small>
                  </span>
                </label>
                <label className={`staff-reset-option ${resetMode === 'manual' ? 'is-selected' : ''}`}>
                  <input
                    className="staff-reset-radio"
                    type="radio"
                    name="reset-password-mode"
                    checked={resetMode === 'manual'}
                    onChange={() => setResetMode('manual')}
                  />
                  <span className="staff-reset-option-copy">
                    <strong>Set a password manually</strong>
                    <small>Use a password that meets the clinic policy.</small>
                  </span>
                </label>
              </fieldset>
              {resetMode === 'manual' && (
                <div className="form-group mb-0">
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: 2 }}>New Password *</label>
                  <PasswordField
                    required
                    minLength={10}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ height: 32, fontSize: '0.8rem' }}
                  />
                </div>
              )}
              {resetMode === 'default' && (
                <p style={{ fontSize: '0.74rem', color: 'var(--clr-text-muted)', margin: 0 }}>
                  The account is reset to the default password from Settings; the user must change it at first sign-in.
                </p>
              )}
              {generatedPassword && (
                <div className="alert alert-success mt-3">
                  Temporary password (shown once): <code>{generatedPassword}</code>
                  <div>The user will be required to change this password at their next sign-in.</div>
                </div>
              )}

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
                <LoadingButton
                  type="submit"
                  className="btn btn-warning btn-sm"
                  disabled={resetting}
                  loading={resetting}
                  loadingLabel="Resetting…"
                  style={{ height: 30, fontSize: '0.78rem', padding: '0 0.75rem', fontWeight: 600 }}
                >
                  {generatedPassword ? 'Done' : 'Reset Password'}
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
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
