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

/** Keys that are always allowed regardless of character filtering */
const ALLOWED_KEYS = new Set([
  'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Home', 'End',
]);

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

  /** Compute max length from the CURRENT value so the counter tracks correctly */
  const maxLength = trimmed.startsWith('+') ? 13 : 10;

  /**
   * Block any character that is:
   *  - not a digit
   *  - not '+' typed at position 0 when the field is empty / starts with 0
   *  - would exceed the allowed length after insertion
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Always pass through keyboard shortcuts and navigation
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (ALLOWED_KEYS.has(e.key)) return;

    const input = e.currentTarget;
    const curVal = input.value;
    const selStart = input.selectionStart ?? curVal.length;
    const selEnd   = input.selectionEnd   ?? curVal.length;
    const selectedLen = selEnd - selStart;
    // Length after inserting this character (replacing selection)
    const nextLen = curVal.length - selectedLen + 1;

    // Only allow '+' at position 0 when there's no existing '+' and the field is empty
    if (e.key === '+') {
      if (selStart === 0 && !curVal.includes('+')) return; // allowed
      e.preventDefault();
      return;
    }

    // Block all non-digit characters
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
      return;
    }

    // Enforce max length: determine what max would be for the NEXT value
    const nextStartsWith = e.key === '+' ? '+' : (selStart === 0 && !curVal ? e.key : curVal[0] ?? e.key);
    const nextMax = nextStartsWith === '+' ? 13 : 10;
    if (nextLen > nextMax) {
      e.preventDefault();
    }
  };

  /** Strip non-phone characters and enforce length on change (covers paste, autofill, IME) */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatEthiopianPhoneInput(e.target.value);
    onChange(formatted);
  };

  /** Handle paste: strip non-digits/plus and enforce max length */
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const input = e.currentTarget;
    const before = input.value.slice(0, input.selectionStart ?? 0);
    const after  = input.value.slice(input.selectionEnd   ?? input.value.length);
    const formatted = formatEthiopianPhoneInput(before + pasted + after);
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
    <div style={style}>
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
          type="text"
          inputMode="tel"
          className={inputClass}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
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
