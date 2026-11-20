import React, { useState } from 'react';
import { Phone, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatEthiopianPhoneInput, ETHIOPIAN_PHONE_REGEX } from '../../utils/validation';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  label?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
}

export default function PhoneInput({
  value,
  onChange,
  onBlur,
  id,
  name,
  label,
  required = false,
  error,
  placeholder = '+2519xxxxxxxx or 09xxxxxxxx',
  style,
  className = '',
  disabled = false,
}: PhoneInputProps) {
  const [touched, setTouched] = useState(false);

  const trimmed = (value || '').trim();
  const isComplete = ETHIOPIAN_PHONE_REGEX.test(trimmed);
  const maxLength = trimmed.startsWith('+') ? 13 : 10;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatEthiopianPhoneInput(e.target.value);
    onChange(formatted);
  };

  const handleBlur = () => {
    setTouched(true);
    if (onBlur) onBlur();
  };

  const hasError = Boolean(error || (touched && required && !trimmed) || (touched && trimmed && !isComplete));
  const errorMessage = error || (touched && trimmed && !isComplete
    ? 'Phone must be in format +2519xxxxxxxx, +2517xxxxxxxx, 09xxxxxxxx, or 07xxxxxxxx.'
    : touched && required && !trimmed
    ? 'Phone number is required.'
    : '');

  const inputClass = `${className} ${hasError ? 'is-invalid' : touched && isComplete ? 'is-valid' : ''}`.trim();

  return (
    <div className="form-group" style={style}>
      {label && (
        <label className="form-label" htmlFor={id}>
          {label} {required && '*'}
        </label>
      )}
      <div className="input-group">
        <div className="input-group-prepend">
          <span className="input-group-text" title="Ethiopian Phone Number">
            <Phone size={14} style={{ color: hasError ? '#dc3545' : isComplete ? '#28a745' : 'inherit' }} />
          </span>
        </div>
        <input
          id={id}
          name={name}
          type="tel"
          className={inputClass}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          disabled={disabled}
          autoComplete="tel"
        />
      </div>

      <div className="phone-format-hint">
        <span>Formats: <strong>+2519...</strong>, <strong>+2517...</strong>, <strong>09...</strong>, <strong>07...</strong></span>
        <span>{value ? `${value.length}/${maxLength}` : `max ${maxLength}`}</span>
      </div>

      {hasError && errorMessage && (
        <div className="invalid-feedback d-flex align-items-center gap-1">
          <AlertCircle size={12} /> {errorMessage}
        </div>
      )}

      {!hasError && touched && isComplete && (
        <div className="valid-feedback d-flex align-items-center gap-1">
          <CheckCircle2 size={12} /> Valid Ethiopian phone number
        </div>
      )}
    </div>
  );
}
