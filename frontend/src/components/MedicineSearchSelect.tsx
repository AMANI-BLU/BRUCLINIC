import { useState, useRef, useEffect } from 'react';
import { Search, X, Pill, CheckCircle2, AlertCircle, Plus, Package } from 'lucide-react';
import type { MedicineItem } from '../types';

export interface MedicineSelectResult {
  name: string;
  medicineId?: string;
  unit?: string;
  stock?: number;
  isCustom?: boolean;
}

export interface MedicineSearchSelectProps {
  value: string;
  medicineId?: string;
  medicines: MedicineItem[];
  onChange: (result: MedicineSelectResult) => void;
  placeholder?: string;
  required?: boolean;
}

export default function MedicineSearchSelect({
  value,
  medicineId,
  medicines,
  onChange,
  placeholder = 'Search clinic formulary or type medicine name...',
  required = false,
}: MedicineSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Selected catalogue item
  const selectedMed = medicineId
    ? medicines.find((m) => m.id === medicineId)
    : medicines.find((m) => m.name.toLowerCase() === value.trim().toLowerCase());

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered catalogue matches
  const trimmed = searchQuery.trim().toLowerCase();
  const filteredMedicines = trimmed
    ? medicines.filter(
        (m) =>
          m.name.toLowerCase().includes(trimmed) ||
          m.category.toLowerCase().includes(trimmed) ||
          m.unit.toLowerCase().includes(trimmed)
      )
    : medicines.slice(0, 8); // show first 8 as quick suggestions when opened empty

  const isExactMatch = medicines.some((m) => m.name.toLowerCase() === trimmed);
  const showCustomOption = trimmed.length > 0 && !isExactMatch;
  const totalOptions = filteredMedicines.length + (showCustomOption ? 1 : 0);

  const handleSelectMed = (med: MedicineItem) => {
    onChange({
      name: med.name,
      medicineId: med.id,
      unit: med.unit,
      stock: med.stock,
      isCustom: false,
    });
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleSelectCustom = () => {
    onChange({
      name: searchQuery.trim(),
      medicineId: undefined,
      unit: 'Unit',
      stock: 0,
      isCustom: true,
    });
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({
      name: '',
      medicineId: undefined,
      unit: '',
      stock: undefined,
      isCustom: false,
    });
    setSearchQuery('');
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(1, totalOptions));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + totalOptions) % Math.max(1, totalOptions));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex < filteredMedicines.length) {
        handleSelectMed(filteredMedicines[highlightedIndex]);
      } else if (showCustomOption) {
        handleSelectCustom();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* If a medicine is already selected, display as an interactive clinical chip */}
      {value && !isOpen ? (
        <div
          onClick={() => {
            setIsOpen(true);
            setSearchQuery(value);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--clr-bg-surface, #ffffff)',
            border: '1px solid var(--clr-border, #cbd5e1)',
            borderRadius: '6px',
            padding: '0.42rem 0.65rem',
            cursor: 'pointer',
            minHeight: '38px',
            transition: 'border-color 0.15s ease',
          }}
          title="Click to search or change medicine"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '4px',
                background: selectedMed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                color: selectedMed ? '#10b981' : '#8b5cf6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Pill size={14} />
            </div>

            <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--clr-text-primary, #0f172a)' }}>
                {value}
              </span>
              {selectedMed && (
                <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted, #64748b)', marginLeft: 6 }}>
                  · {selectedMed.category} ({selectedMed.unit})
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {selectedMed ? (
              selectedMed.stock > 0 ? (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    color: '#059669',
                    background: '#ecfdf5',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid #a7f3d0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <CheckCircle2 size={11} /> {selectedMed.stock} in stock
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    color: '#dc2626',
                    background: '#fef2f2',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid #fecaca',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <AlertCircle size={11} /> Out of stock
                </span>
              )
            ) : (
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  color: '#7c3aed',
                  background: '#f5f3ff',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid #ddd6fe',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Package size={11} /> Non-catalogue
              </span>
            )}

            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--clr-text-muted, #94a3b8)',
                cursor: 'pointer',
                padding: '2px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Clear & choose another medicine"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        /* Unified Search Input */
        <div style={{ position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--clr-text-muted, #94a3b8)',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search size={14} />
          </div>

          <input
            ref={inputRef}
            type="text"
            required={required}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
              setHighlightedIndex(0);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            style={{
              paddingLeft: '32px',
              paddingRight: searchQuery ? '30px' : '10px',
              width: '100%',
              height: '38px',
              fontSize: '0.85rem',
            }}
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                inputRef.current?.focus();
              }}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--clr-text-muted)',
                cursor: 'pointer',
                padding: 2,
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--clr-bg-surface, #ffffff)',
            border: '1px solid var(--clr-border, #cbd5e1)',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 9999,
            maxHeight: '260px',
            overflowY: 'auto',
          }}
        >
          {/* Header indicator */}
          <div
            style={{
              padding: '6px 10px',
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--clr-text-muted, #64748b)',
              background: 'var(--clr-bg-subtle, #f8fafc)',
              borderBottom: '1px solid var(--clr-border, #e2e8f0)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Clinic Formulary ({medicines.length} in stock)</span>
            <span>Use ↑↓ to navigate, Enter to pick</span>
          </div>

          {filteredMedicines.length > 0 ? (
            filteredMedicines.map((med, idx) => {
              const isHighlighted = idx === highlightedIndex;
              const inStock = med.stock > 0;

              return (
                <div
                  key={med.id}
                  onClick={() => handleSelectMed(med)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: isHighlighted ? 'var(--clr-bg-hover, #f1f5f9)' : 'transparent',
                    borderBottom: '1px solid var(--clr-border-subtle, #f1f5f9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    transition: 'background 0.1s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '4px',
                        background: inStock ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: inStock ? '#10b981' : '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Pill size={13} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--clr-text-primary, #0f172a)' }}>
                        {med.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted, #64748b)' }}>
                        {med.category} · {med.unit}
                      </div>
                    </div>
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    {inStock ? (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: '#059669',
                          background: '#ecfdf5',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <CheckCircle2 size={11} /> {med.stock} in stock
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: '#dc2626',
                          background: '#fef2f2',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <AlertCircle size={11} /> 0 in stock
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--clr-text-muted)', fontSize: '0.8rem' }}>
              No catalogue medicine matches "{searchQuery}"
            </div>
          )}

          {/* Option to prescribe as Custom / Non-Catalogue item */}
          {showCustomOption && (
            <div
              onClick={handleSelectCustom}
              onMouseEnter={() => setHighlightedIndex(filteredMedicines.length)}
              style={{
                padding: '9px 12px',
                cursor: 'pointer',
                background:
                  highlightedIndex === filteredMedicines.length
                    ? 'rgba(139, 92, 246, 0.12)'
                    : 'rgba(139, 92, 246, 0.05)',
                borderTop: '1px dashed var(--clr-border, #cbd5e1)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#7c3aed',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              <Plus size={15} />
              <span>
                Prescribe "<strong>{searchQuery.trim()}</strong>" as Custom / Non-Formulary Medicine
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

