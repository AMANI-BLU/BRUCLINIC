import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Package, X } from 'lucide-react';
import type { MedicineItem } from '../types';
import ModalPortal from './ModalPortal';

type StockAction = 'add' | 'dispense';

interface AdjustMedicineStockModalProps {
  medicine: MedicineItem;
  onClose: () => void;
  onAdjust: (delta: number) => Promise<void>;
}

export default function AdjustMedicineStockModal({ medicine, onClose, onAdjust }: AdjustMedicineStockModalProps) {
  const [action, setAction] = useState<StockAction>('add');
  const [quantity, setQuantity] = useState('1');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedQuantity = Number(quantity);
  const isValidQuantity = Number.isInteger(parsedQuantity) && parsedQuantity > 0;
  const exceedsStock = action === 'dispense' && isValidQuantity && parsedQuantity > medicine.stock;
  const projectedStock = isValidQuantity
    ? medicine.stock + (action === 'add' ? parsedQuantity : -parsedQuantity)
    : medicine.stock;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidQuantity) {
      setError('Enter a whole quantity greater than zero.');
      return;
    }
    if (exceedsStock) {
      setError(`Only ${medicine.stock} ${medicine.unit} are available.`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onAdjust(action === 'add' ? parsedQuantity : -parsedQuantity);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update stock.');
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={() => !saving && onClose()}>
        <div className="modal pharmacy-adjust-modal" role="dialog" aria-modal="true" aria-labelledby="adjust-stock-title" onClick={event => event.stopPropagation()}>
          <div className="modal-header pharmacy-adjust-header">
            <div className="pharmacy-adjust-title-icon"><Package size={18} /></div>
            <div className="pharmacy-adjust-title-copy">
              <h2 id="adjust-stock-title">Adjust stock</h2>
              <p>{medicine.name} · {medicine.category || 'General'} · {medicine.unit}</p>
            </div>
            <button type="button" className="modal-close-btn" onClick={onClose} disabled={saving} aria-label="Close dialog"><X size={16} /></button>
          </div>

          <form className="pharmacy-adjust-form" onSubmit={handleSubmit}>
            {error && <div className="alert alert-danger py-2 px-3 mb-0" role="alert">{error}</div>}

            <div className="pharmacy-stock-balance">
              <div><span>Current stock</span><strong>{medicine.stock} <small>{medicine.unit}</small></strong></div>
              <div><span>Minimum stock</span><strong>{medicine.minStock} <small>{medicine.unit}</small></strong></div>
            </div>

            <fieldset className="pharmacy-adjust-actions">
              <legend>Adjustment type</legend>
              <button type="button" className={`pharmacy-adjust-choice ${action === 'add' ? 'selected add' : ''}`} aria-pressed={action === 'add'} onClick={() => { setAction('add'); setError(''); }}>
                <ArrowDownToLine size={17} />
                <span><strong>Add stock</strong><small>Receive a supply</small></span>
              </button>
              <button type="button" className={`pharmacy-adjust-choice ${action === 'dispense' ? 'selected dispense' : ''}`} aria-pressed={action === 'dispense'} disabled={medicine.stock === 0} onClick={() => { setAction('dispense'); setError(''); }}>
                <ArrowUpFromLine size={17} />
                <span><strong>Dispense</strong><small>Remove from clinic stock</small></span>
              </button>
            </fieldset>

            <div className="form-group pharmacy-adjust-quantity-field">
              <label className="form-label" htmlFor="stock-adjust-quantity">Quantity ({medicine.unit})</label>
              <input id="stock-adjust-quantity" type="number" min="1" step="1" inputMode="numeric" autoFocus value={quantity} onChange={event => { setQuantity(event.target.value); setError(''); }} />
              {action === 'dispense' && <small>Available: {medicine.stock} {medicine.unit}</small>}
            </div>

            <div className={`pharmacy-stock-preview ${exceedsStock ? 'invalid' : ''}`} aria-live="polite">
              <span>New stock balance</span>
              <strong>{isValidQuantity && !exceedsStock ? projectedStock : '—'} <small>{medicine.unit}</small></strong>
            </div>

            <div className="modal-footer pharmacy-adjust-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="submit" className={`btn ${action === 'add' ? 'btn-success' : 'btn-danger'}`} disabled={saving || !isValidQuantity || exceedsStock}>
                {saving ? 'Saving…' : <><CheckCircle2 size={15} /> {action === 'add' ? 'Add to inventory' : 'Confirm dispense'}</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}