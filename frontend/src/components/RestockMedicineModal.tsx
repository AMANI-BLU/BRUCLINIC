import React, { useState } from 'react';
import { Package, X, CheckCircle2, ArrowRight, Building, Calendar, DollarSign, Layers } from 'lucide-react';
import type { MedicineItem } from '../types';
import { validateNumber, validateDate } from '../utils/validation';
import ModalPortal from './ModalPortal';

interface RestockMedicineModalProps {
  medicine: MedicineItem;
  onClose: () => void;
  onRestock: (additionalStock: number, updates: { expiryDate?: string; supplier?: string; costPerUnit?: number; batchNumber?: string }) => Promise<void>;
}

export default function RestockMedicineModal({
  medicine,
  onClose,
  onRestock,
}: RestockMedicineModalProps) {
  const [quantity, setQuantity] = useState<number>(100);
  const [batchNumber, setBatchNumber] = useState<string>(`LOT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [expiryDate, setExpiryDate] = useState<string>(medicine.expiryDate || '');
  const [supplier, setSupplier] = useState<string>(medicine.supplier || 'Ethiopian Pharmaceuticals Supply Agency (EPSA)');
  const [costPerUnit, setCostPerUnit] = useState<number>(medicine.costPerUnit || 1.5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOutOfStock = medicine.stock === 0;
  const isLowStock = medicine.stock > 0 && medicine.stock <= medicine.minStock;
  const projectedStock = Math.max(0, medicine.stock + (Number(quantity) || 0));
  const totalValuation = ((Number(quantity) || 0) * (Number(costPerUnit) || 0)).toFixed(2);

  const handleQuickAdd = (amount: number) => {
    setQuantity(prev => Math.max(1, prev + amount));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const qtyError = validateNumber(String(quantity), 'Restock Quantity', { min: 1, integer: true });
    if (qtyError) {
      setError(qtyError);
      return;
    }

    if (expiryDate) {
      const expError = validateDate(expiryDate, 'Expiry Date', { allowPast: false });
      if (expError) {
        setError(expError);
        return;
      }
    }

    try {
      setLoading(true);
      await onRestock(Number(quantity), {
        expiryDate: expiryDate || medicine.expiryDate,
        supplier: supplier.trim() || medicine.supplier,
        costPerUnit: Number(costPerUnit) || medicine.costPerUnit,
        batchNumber: batchNumber.trim(),
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not restock this item.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal"
        style={{ width: 'min(96%, 600px)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--clr-border)', paddingBottom: '0.75rem' }}>
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.1rem', margin: 0 }}>
              <Package size={20} className="text-primary" /> Inventory Consignment Restock
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)', marginTop: 2 }}>
              Hospital Pharmacy Supply Chain &amp; Formulary Replenishment
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          {error && <div className="alert alert-danger py-2 px-3 mb-0" role="alert">{error}</div>}

          {/* Current Inventory Summary Card */}
          <div style={{
            background: 'var(--clr-bg-hover)',
            border: '1px solid var(--clr-border)',
            borderRadius: 6,
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--clr-text-primary)' }}>{medicine.name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)' }}>
                Category: <strong>{medicine.category}</strong> · Form: <strong>{medicine.unit}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>Current In-Stock</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: isOutOfStock ? 'var(--clr-rose-400)' : isLowStock ? 'var(--clr-amber-400)' : 'var(--clr-emerald-400)' }}>
                  {medicine.stock} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{medicine.unit}s</span>
                </div>
              </div>
              <span className={`badge ${isOutOfStock ? 'badge-red' : isLowStock ? 'badge-amber' : 'badge-green'}`} style={{ height: 'fit-content' }}>
                {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
              </span>
            </div>
          </div>

          {/* Restock Quantity Controls */}
          <div style={{ border: '1px solid var(--clr-border)', borderRadius: 6, padding: '12px 16px', background: 'var(--clr-bg-surface)' }}>
            <label className="form-label" style={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
              <span>Quantity to Add ({medicine.unit}s) *</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)', fontWeight: 400 }}>Minimum threshold: {medicine.minStock} units</span>
            </label>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                required
                min={1}
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
                style={{ fontSize: '1.15rem', fontWeight: 700, padding: '0.5rem 0.75rem' }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                {[50, 100, 250, 500].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleQuickAdd(amt)}
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.55rem' }}
                  >
                    +{amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Projected Stock Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 10,
              padding: '6px 10px',
              background: 'rgba(59, 130, 246, 0.08)',
              borderRadius: 4,
              fontSize: '0.82rem'
            }}>
              <Layers size={15} className="text-primary" />
              <span>Current: <strong>{medicine.stock}</strong></span>
              <ArrowRight size={13} className="text-muted" />
              <span>After Restock: <strong style={{ color: 'var(--clr-emerald-400)', fontSize: '0.9rem' }}>{projectedStock} {medicine.unit}s</strong></span>
              <span style={{ marginLeft: 'auto', color: 'var(--clr-text-muted)', fontSize: '0.75rem' }}>
                Est. Total: ETB {totalValuation}
              </span>
            </div>
          </div>

          {/* Consignment Quality & Batch Metadata */}
          <div className="form-grid" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Layers size={13} /> Batch / Lot Number
              </label>
              <input
                value={batchNumber}
                onChange={e => setBatchNumber(e.target.value)}
                placeholder="e.g. LOT-2026-9081"
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Calendar size={13} /> Batch Expiry Date
              </label>
              <input
                type="date"
                required
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Building size={13} /> Supplier / Vendor
              </label>
              <input
                value={supplier}
                onChange={e => setSupplier(e.target.value)}
                placeholder="Distributor or agency name"
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <DollarSign size={13} /> Unit Cost (ETB)
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={costPerUnit}
                onChange={e => setCostPerUnit(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid var(--clr-border)', paddingTop: '0.75rem', marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || quantity <= 0}>
              {loading ? 'Restocking…' : <><CheckCircle2 size={16} /> Confirm Restock ({quantity} {medicine.unit}s)</>}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}
