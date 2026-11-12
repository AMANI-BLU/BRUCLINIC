import { useState } from 'react';
import { Pill, CheckCircle2, AlertTriangle, X, Package, AlertCircle, ShoppingBag, Printer } from 'lucide-react';
import type { PharmacyOrder, MedicineItem } from '../types';
import { formatDateTime12 } from '../utils/date';
import PrescriptionPrintModal from './PrescriptionPrintModal';
import ModalPortal from './ModalPortal';
import LoadingButton from './LoadingButton';

export interface ConfirmDispenseModalProps {
  order: PharmacyOrder | null;
  medicines: MedicineItem[];
  patientCode?: string;
  patientAge?: number;
  patientGender?: string;
  patientWeight?: number;
  onSelect: (orderId: string, medicineId?: string, quantity?: number, overrides?: Record<string, string>, quantities?: Record<string, number>) => Promise<void> | void;
  onClose: () => void;
}

export default function ConfirmDispenseModal({
  order,
  medicines,
  patientCode,
  patientAge,
  patientGender,
  patientWeight,
  onSelect,
  onClose,
}: ConfirmDispenseModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [dispenseModes, setDispenseModes] = useState<Record<string, 'clinic' | 'outside'>>({});
  const [dispenseQuantities, setDispenseQuantities] = useState<Record<string, number>>({});
  const [showPrintSlip, setShowPrintSlip] = useState(false);

  if (!order) return null;

  // Find inventory match for each prescribed medicine, taking pharmacist overrides and mode choices into account
  const itemsWithStock = (order.medicines || []).map((med) => {
    const overrideId = mappings[med.name];
    const inventoryMatch = medicines.find(
      (m) =>
        (overrideId && m.id === overrideId) ||
        (!overrideId && med.medicineId && m.id === med.medicineId) ||
        (!overrideId && m.name.toLowerCase() === med.name.toLowerCase()) ||
        (!overrideId && med.name.length >= 3 && m.name.toLowerCase().includes(med.name.toLowerCase()))
    );
    const chosenQuantity = dispenseQuantities[med.name] ?? (med.quantity && med.quantity > 0 ? med.quantity : 1);
    const availableStock = inventoryMatch ? inventoryMatch.stock : 0;
    // Pharmacist source choice: default to 'clinic' if stock available, else 'outside'
    const mode = dispenseModes[med.name] || (med.isExternal ? 'outside' : inventoryMatch && availableStock >= chosenQuantity ? 'clinic' : 'outside');
    const isExternal = mode === 'outside';
    const isOutOfStock = !isExternal && inventoryMatch ? availableStock < chosenQuantity : false;

    return {
      ...med,
      quantity: chosenQuantity,
      inventoryMatch,
      availableStock,
      isOutOfStock,
      isExternal,
      mode,
    };
  });

  const hasInsufficientStock = itemsWithStock.some((item) => item.isOutOfStock);

  const handleConfirm = async () => {
    if (!order) return;
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const firstItem = itemsWithStock[0];
      const effectiveMappings = { ...mappings };
      const dispenseQuantitiesByItem: Record<string, number> = {};
      for (const item of itemsWithStock) {
        dispenseQuantitiesByItem[item.name] = item.quantity;
        if (item.isExternal) {
          effectiveMappings[item.name] = '__BUY_OUTSIDE__';
        }
      }

      await onSelect(
        order.id,
        firstItem?.inventoryMatch?.id || firstItem?.medicineId,
        firstItem?.quantity,
        effectiveMappings,
        dispenseQuantitiesByItem
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dispense order');
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={() => !submitting && onClose()}>
      <div
        className="modal"
        style={{
          maxWidth: 620,
          width: '100%',
          padding: '1.5rem',
          borderRadius: 'var(--radius-lg, 12px)',
          animation: 'fadeIn 0.15s ease-out',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dispense-title"
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.25rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--clr-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.12)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Pill size={20} />
            </div>
            <div>
              <h2
                id="confirm-dispense-title"
                style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--clr-text-primary)' }}
              >
                Confirm Dispense &amp; Deduct Stock
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)' }}>
                Order #{order.id.slice(0, 8)} · Prescribed by {order.doctorName}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowPrintSlip(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}
              title="Print the full prescription order for the patient"
            >
              <Printer size={14} /> Print Full Order
            </button>
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              disabled={submitting}
              aria-label="Close dialog"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--clr-text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {error && (
            <div
              className="alert alert-danger"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem',
                fontSize: '0.85rem',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Patient Details banner */}
          <div
            style={{
              background: 'var(--clr-bg-subtle, rgba(255,255,255,0.03))',
              border: '1px solid var(--clr-border)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.75rem',
              fontSize: '0.82rem',
            }}
          >
            <div>
              <div style={{ color: 'var(--clr-text-muted)', fontSize: '0.72rem' }}>Patient</div>
              <div style={{ fontWeight: 600, color: 'var(--clr-text-primary)' }}>{order.patientName}</div>
            </div>
            <div>
              <div style={{ color: 'var(--clr-text-muted)', fontSize: '0.72rem' }}>Prescribed Date</div>
              <div style={{ fontWeight: 500, color: 'var(--clr-text-primary)' }}>
                {formatDateTime12(order.prescribedAt, order.createdAt)}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--clr-text-muted)', fontSize: '0.72rem' }}>Prescription Items</div>
              <div style={{ fontWeight: 600, color: 'var(--clr-text-primary)' }}>
                {itemsWithStock.length} medication{itemsWithStock.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Prescribed Items List */}
          <div style={{ marginBottom: '1rem' }}>
            <h4
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--clr-text-muted)',
                marginBottom: '0.6rem',
              }}
            >
              Prescribed Medications &amp; Stock Availability
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {itemsWithStock.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    border: '1px solid var(--clr-border)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    background: item.isOutOfStock
                      ? 'rgba(239, 68, 68, 0.04)'
                      : 'var(--clr-bg-surface)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {item.inventoryMatch?.imageUrl ? (
                        <img
                          src={item.inventoryMatch.imageUrl}
                          alt={item.name}
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: '6px',
                            objectFit: 'cover',
                            border: '1px solid var(--clr-border)',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: '6px',
                            background: 'var(--clr-bg-subtle, rgba(255,255,255,0.05))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--clr-text-muted)',
                          }}
                        >
                          <Package size={18} />
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--clr-text-primary)' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)' }}>
                          {item.instructions || 'Dose as directed by the prescriber'}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--clr-text-muted)' }}>Qty:</span>
                        <input
                          type="number"
                          min={1}
                          max={item.mode === 'clinic' && item.inventoryMatch ? item.availableStock || 1 : 999}
                          value={item.quantity}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value) || 1);
                            setDispenseQuantities(prev => ({ ...prev, [item.name]: val }));
                          }}
                          style={{
                            width: 58,
                            padding: '2px 5px',
                            textAlign: 'center',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            borderRadius: 4,
                            border: '1px solid var(--clr-border)',
                            background: 'var(--clr-bg-card)',
                            color: 'var(--clr-text-primary)',
                          }}
                          title="Define quantity to dispense from inventory or advise for purchase"
                        />
                      </div>

                      {/* Source Choice Toggle for Pharmacist */}
                      <div style={{ display: 'inline-flex', gap: 3, marginTop: 2 }}>
                        <button
                          type="button"
                          className={`btn ${item.mode === 'clinic' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: 4, height: 'auto' }}
                          onClick={() => setDispenseModes((prev) => ({ ...prev, [item.name]: 'clinic' }))}
                          disabled={!item.inventoryMatch || item.availableStock === 0}
                          title={!item.inventoryMatch ? 'Not in inventory stock' : item.availableStock === 0 ? 'Out of stock in dispensary' : 'Fulfill from clinic inventory'}
                        >
                          <CheckCircle2 size={11} /> Clinic Dispense
                        </button>
                        <button
                          type="button"
                          className={`btn ${item.mode === 'outside' ? 'btn-warning' : 'btn-secondary'}`}
                          style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: 4, height: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                          onClick={() => setDispenseModes((prev) => ({ ...prev, [item.name]: 'outside' }))}
                          title="Patient will purchase from outside retail pharmacy"
                        >
                          <ShoppingBag size={11} /> Buy Outside
                        </button>
                      </div>

                      <div style={{ fontSize: '0.75rem', marginTop: 2 }}>
                        {item.mode === 'clinic' ? (
                          item.isOutOfStock ? (
                            <span style={{ color: 'var(--admin-danger, #ef4444)', fontWeight: 600 }}>
                              Only {item.availableStock} in stock
                            </span>
                          ) : (
                            <span style={{ color: 'var(--admin-success, #22c55e)', fontWeight: 500 }}>
                              {item.availableStock} in stock (deducting {item.quantity})
                            </span>
                          )
                        ) : (
                          <span style={{ color: '#d97706', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <ShoppingBag size={11} /> Outside retail pharmacy purchase
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {!item.inventoryMatch && (
                    <div style={{ marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px dashed var(--clr-border)' }}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)', display: 'block', marginBottom: 3 }}>
                        Link to Pharmacy Stock (resolves doctor typos &amp; deducts inventory):
                      </label>
                      <select
                        style={{
                          fontSize: '0.76rem',
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: '1px solid var(--clr-border)',
                          background: 'var(--clr-bg-base)',
                          color: 'var(--clr-text-primary)',
                          width: '100%',
                        }}
                        value={mappings[item.name] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMappings((prev) => ({ ...prev, [item.name]: val }));
                        }}
                      >
                        <option value="">-- Dispense as external prescription without inventory deduction --</option>
                        {medicines.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.stock} {m.unit} in stock)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {item.instructions && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        paddingTop: '0.4rem',
                        borderTop: '1px dashed var(--clr-border)',
                        fontSize: '0.75rem',
                        color: 'var(--clr-text-muted)',
                      }}
                    >
                      Instructions: <span style={{ color: 'var(--clr-text-primary)' }}>{item.instructions}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {hasInsufficientStock && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--admin-danger, #ef4444)',
                fontSize: '0.82rem',
                marginBottom: '1rem',
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Stock Warning:</strong> One or more items exceed current inventory stock.
                Confirming will fail if stock is insufficient.
              </div>
            </div>
          )}

          {order.notes && (
            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--clr-text-muted)',
                marginBottom: '1rem',
                padding: '0.5rem 0.75rem',
                background: 'var(--clr-bg-subtle, rgba(255,255,255,0.02))',
                borderRadius: '6px',
              }}
            >
              <strong>Order Notes:</strong> {order.notes}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--clr-border)',
            marginTop: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowPrintSlip(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Printer size={15} /> Print Full Order Slip
          </button>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <LoadingButton
              type="button"
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={submitting}
              loading={submitting}
              loadingLabel="Dispensing…"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <><CheckCircle2 size={16} /> Confirm &amp; Dispense Order</>
            </LoadingButton>
          </div>
        </div>
      </div>

      {showPrintSlip && order && (
        <PrescriptionPrintModal
          isOpen={showPrintSlip}
          onClose={() => setShowPrintSlip(false)}
          patientName={order.patientName}
          patientCode={patientCode}
          patientAge={patientAge}
          patientGender={patientGender}
          patientWeight={patientWeight}
          doctorName={order.doctorName}
          medicines={itemsWithStock.map((item) => ({
            name: item.name,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            quantity: item.quantity,
            instructions: item.instructions,
            isExternal: item.isExternal,
          }))}
          notes={order.notes}
          initialMode={itemsWithStock.some(item => !item.isExternal) ? 'clinic' : 'outside'}
        />
      )}
    </div>
    </ModalPortal>
  );
}
