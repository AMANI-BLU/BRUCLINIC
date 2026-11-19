import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Stethoscope, Check, X, Search, Plus } from 'lucide-react';
import { searchDiagnoses } from '../utils/diagnosis';

interface DiagnosisFieldProps {
  label: string;
  value: string;
  diagnoses?: string[];
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export default function DiagnosisField({
  label,
  value,
  diagnoses = [],
  onChange,
  required,
  placeholder = 'Type to search or enter diagnosis...',
  className = '',
}: DiagnosisFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute suggestions based on input value
  const suggestions = useMemo(() => {
    return searchDiagnoses(value, diagnoses);
  }, [value, diagnoses]);

  // Check if current value exactly matches any suggestion
  const isExactMatch = useMemo(() => {
    const valClean = value.trim().toLowerCase();
    return suggestions.some(s => s.toLowerCase() === valClean);
  }, [value, suggestions]);

  // Total selectable items: suggestions + custom item if non-empty and not exact match
  const showCustomOption = Boolean(value.trim() && !isExactMatch);
  const totalOptions = suggestions.length + (showCustomOption ? 1 : 0);

  // Handle outside click to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (diag: string) => {
    onChange(diag);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      setHighlightedIndex(0);
      return;
    }

    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1 < totalOptions ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 >= 0 ? prev - 1 : totalOptions - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < totalOptions) {
        e.preventDefault();
        if (highlightedIndex < suggestions.length) {
          handleSelect(suggestions[highlightedIndex]);
        } else if (showCustomOption) {
          handleSelect(value.trim());
        }
      } else if (value.trim()) {
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(true);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  return (
    <div className={`form-group ${className}`} style={{ position: 'relative' }} ref={containerRef}>
      <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
        <span>
          {label}
          {required && <span className="text-danger" style={{ marginLeft: 3 }}>*</span>}
        </span>
        {value && (
          <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-secondary)', fontWeight: 500 }}>
            Press Enter or pick suggestion
          </span>
        )}
      </label>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="text"
          className="form-control"
          style={{
            paddingRight: value ? '3.5rem' : '2.2rem',
            borderRadius: '6px',
            fontSize: '0.88rem',
          }}
          required={required}
          value={value}
          placeholder={placeholder}
          onFocus={() => {
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onChange={e => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />

        {/* Clear & Search icon buttons inside input */}
        <div style={{ position: 'absolute', right: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          {value ? (
            <button
              type="button"
              onClick={handleClear}
              title="Clear diagnosis"
              style={{
                border: 'none',
                background: 'transparent',
                padding: '2px 4px',
                cursor: 'pointer',
                color: 'var(--clr-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px',
              }}
            >
              <X size={15} />
            </button>
          ) : null}
          <span style={{ color: 'var(--clr-text-secondary)', display: 'flex', alignItems: 'center', pointerEvents: 'none', paddingRight: 4 }}>
            <Search size={15} />
          </span>
        </div>
      </div>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && (
        <div
          className="diagnosis-dropdown-menu shadow-sm"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1050,
            marginTop: 4,
            backgroundColor: 'var(--clr-bg-surface, #ffffff)',
            border: '1px solid var(--clr-border, #dee2e6)',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: '6px 10px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--clr-text-secondary)', borderBottom: '1px solid var(--clr-border, #f1f3f5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>DIAGNOSIS SUGGESTIONS ({suggestions.length})</span>
            <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>Use ↑↓ arrows to navigate</span>
          </div>

          {suggestions.length === 0 && !showCustomOption && (
            <div style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--clr-text-secondary)', fontSize: '0.82rem' }}>
              No standard diagnoses matched. You can type any clinical diagnosis freely.
            </div>
          )}

          {suggestions.map((diag, index) => {
            const isSelected = diag.toLowerCase() === value.trim().toLowerCase();
            const isHighlighted = highlightedIndex === index;
            return (
              <div
                key={diag}
                onClick={() => handleSelect(diag)}
                onMouseEnter={() => setHighlightedIndex(index)}
                style={{
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  backgroundColor: isHighlighted ? 'var(--clr-bg-hover, #f0f7ff)' : isSelected ? 'var(--clr-bg-active, #e8f4fd)' : 'transparent',
                  color: isSelected ? 'var(--clr-primary, #0d6efd)' : 'inherit',
                  fontWeight: isSelected ? 600 : 400,
                  transition: 'background-color 0.1s ease',
                  borderBottom: '1px solid var(--clr-border-light, #f8f9fa)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Stethoscope size={14} className={isSelected ? 'text-primary' : 'text-muted'} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{diag}</span>
                </div>
                {isSelected && <Check size={14} className="text-primary" style={{ flexShrink: 0 }} />}
              </div>
            );
          })}

          {/* Option to use custom entered text if not matching exactly */}
          {showCustomOption && (
            <div
              onClick={() => handleSelect(value.trim())}
              onMouseEnter={() => setHighlightedIndex(suggestions.length)}
              style={{
                padding: '9px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                fontSize: '0.82rem',
                backgroundColor: highlightedIndex === suggestions.length ? 'var(--clr-bg-hover, #f0f7ff)' : 'transparent',
                color: 'var(--clr-primary, #0d6efd)',
                borderTop: '1px dashed var(--clr-border, #dee2e6)',
                fontWeight: 500,
              }}
            >
              <Plus size={14} style={{ flexShrink: 0 }} />
              <span>Use custom: <strong>"{value.trim()}"</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
