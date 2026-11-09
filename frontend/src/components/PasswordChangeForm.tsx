import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import PasswordField from './PasswordField';
import { Lock } from 'lucide-react';
import './PasswordChangeForm.css';

export default function PasswordChangeForm({ forced = false }: { forced?: boolean }) {
  const { changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (newPassword.length < 8) {
      setError('Use at least 8 characters for the new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setSaving(true);
    const result = await changePassword(currentPassword, newPassword);
    setSaving(false);
    if (!result.success) {
      setError(result.error || 'Unable to change password.');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setMessage(result.message || 'Password changed successfully.');
  };

  return (
    <section className={`card card-outline card-primary pcf-card${forced ? ' pcf-forced' : ''}`}>
      <div className="pcf-heading">
        <div className="pcf-icon">
          <Lock size={18} />
        </div>
        <div>
          <h2 className="pcf-title">{forced ? 'Change your temporary password' : 'Change password'}</h2>
          <p className="pcf-subtitle">{forced ? 'A password change is required before you can continue.' : 'Enter your current password and choose a new one.'}</p>
        </div>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {message && <div className="alert alert-success" role="status">{message}</div>}
      <form onSubmit={submit}>
        <label className="form-label" htmlFor="password-current">Current password</label>
        <PasswordField id="password-current" className="form-control mb-3" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required />
        <label className="form-label" htmlFor="password-new">New password</label>
        <PasswordField id="password-new" className="form-control mb-3" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={8} required />
        <label className="form-label" htmlFor="password-confirm">Confirm new password</label>
        <PasswordField id="password-confirm" className="form-control mb-3" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={8} required />
        <div className="d-flex gap-2">
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Updating…' : 'Update password'}</button>
          <button className="btn btn-secondary" type="button" onClick={logout}>Sign out</button>
        </div>
      </form>
    </section>
  );
}