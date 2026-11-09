import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Password input with a built-in show/hide toggle.
 *
 * Every native <input> prop is forwarded to the field, so it can directly
 * replace `<input type="password" … />` without other changes.
 */
export default function PasswordField({ id, className, ...inputProps }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible ? 'Hide password' : 'Show password';

  return (
    <div className="password-field">
      <input {...inputProps} id={id} className={className} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-field-toggle"
        onClick={() => setVisible(current => !current)}
        aria-label={toggleLabel}
        aria-pressed={visible}
        aria-controls={id}
        title={toggleLabel}
      >
        {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}
