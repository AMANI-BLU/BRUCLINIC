import { useEffect, useState } from 'react';
import { CheckCircle2, ImagePlus, Package, Trash2, X } from 'lucide-react';
import { useClinic } from '../context/ClinicContext';
import { useAuth } from '../context/AuthContext';
import ModalPortal from './ModalPortal';
import type { MedicineItem } from '../types';
import { firstError, validateDate, validateNumber, validateTextLength } from '../utils/validation';
import LoadingButton from './LoadingButton';

interface AddMedicineModalProps {
  onClose: () => void;
}

interface MedicineForm {
  name: string;
  category: string;
  stock: string;
  unit: string;
  expiryDate: string;
  supplier: string;
  minStock: string;
  costPerUnit: string;
}

const EMPTY_FORM: MedicineForm = {
  name: '',
  category: '',
  stock: '',
  unit: 'Tablet',
  expiryDate: '',
  supplier: '',
  minStock: '',
  costPerUnit: '',
};

/** Uploads stay inside the API's 1 MB JSON body budget after base64 encoding. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_CHARS = 600_000;
const MAX_DIMENSION = 640;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('That file could not be read as an image.')); };
    image.src = objectUrl;
  });
}

/** Downscale + re-encode the picked photo so it stores as a compact data URL. */
async function toMedicineImageDataUrl(file: File): Promise<string> {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight, 1));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image upload is not supported in this browser.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  for (const quality of [0.8, 0.65, 0.5, 0.35]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_IMAGE_CHARS) return dataUrl;
  }
  throw new Error('That image is too large to upload. Please choose a smaller photo.');
}

export default function AddMedicineModal({ onClose }: AddMedicineModalProps) {
  const { addMedicine } = useClinic();
  const { currentUser } = useAuth();
  const [form, setForm] = useState<MedicineForm>(EMPTY_FORM);
  const [imageUrl, setImageUrl] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saving, onClose]);

  const setField = (field: keyof MedicineForm, value: string) =>
    setForm(previous => ({ ...previous, [field]: value }));

  const handleImagePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Please choose an image file (JPG, PNG or WEBP).');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setFormError('Please choose an image smaller than 5 MB.');
      return;
    }
    try {
      const dataUrl = await toMedicineImageDataUrl(file);
      setImageUrl(dataUrl);
      setImageFileName(file.name);
      setFormError(null);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not read that image.');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const error = firstError(
      validateTextLength(form.name, 'Medicine name', { required: true, max: 150 }),
      validateDate(form.expiryDate, 'Expiry date', { required: true }),
      validateNumber(form.stock, 'Stock', { min: 0, integer: true }),
      validateNumber(form.minStock, 'Minimum stock', { min: 0, integer: true }),
      validateNumber(form.costPerUnit, 'Cost per unit', { min: 0 }),
      validateTextLength(form.supplier, 'Supplier', { max: 150 }),
      validateTextLength(form.category, 'Category', { max: 120 }),
      validateTextLength(form.unit, 'Unit', { max: 40 }),
    );
    if (error) {
      setFormError(error);
      return;
    }

    const payload: Omit<MedicineItem, 'id'> = {
      name: form.name.trim(),
      category: form.category.trim(),
      stock: Number(form.stock || 0),
      unit: form.unit.trim(),
      expiryDate: form.expiryDate,
      supplier: form.supplier.trim(),
      minStock: Number(form.minStock || 0),
      costPerUnit: Number(form.costPerUnit || 0),
      imageUrl: imageUrl || undefined,
    };

    try {
      setSaving(true);
      await addMedicine(payload);
      setFormError(null);
      onClose();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not save the medicine.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div
        className="modal"
        style={{ maxWidth: 660, width: '100%' }}
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-medicine-title"
      >
        <div className="modal-header">
          <h2 id="add-medicine-title" className="modal-title">
            <Package size={18} className="text-primary" /> Add Medicine to Inventory
          </h2>
          <button type="button" className="modal-close-btn" onClick={onClose} disabled={saving} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="alert alert-danger py-2 px-3" role="alert" style={{ marginBottom: '1rem' }}>
              {formError}
            </div>
          )}

          {/* Photo upload */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div
              style={{
                width: 96, height: 96, borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--clr-border-hi)', background: 'var(--clr-bg-hover)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
              }}
            >
              {imageUrl ? (
                <img src={imageUrl} alt="Medicine preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <ImagePlus size={26} style={{ color: 'var(--clr-text-muted)' }} />
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0 }}>
              <span className="form-label">Medicine Photo</span>
              <span style={{ fontSize: '0.74rem', color: 'var(--clr-text-muted)' }}>
                {imageFileName || 'JPG, PNG or WEBP · resized automatically to 640px'}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                  <ImagePlus size={14} /> {imageUrl ? 'Replace photo' : 'Upload photo'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImagePick}
                    style={{ display: 'none' }}
                  />
                </label>
                {imageUrl && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setImageUrl(''); setImageFileName(''); }}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="form-grid" style={{ marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Medicine Name *</label>
              <input
                required
                value={form.name}
                onChange={event => setField('name', event.target.value)}
                placeholder="e.g. Amoxicillin 500mg"
                maxLength={150}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <input
                value={form.category}
                onChange={event => setField('category', event.target.value)}
                placeholder="e.g. Antibiotic"
                maxLength={120}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              <input
                value={form.unit}
                onChange={event => setField('unit', event.target.value)}
                placeholder="e.g. Tablet, Bottle"
                maxLength={40}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Stock on Hand</label>
              <input
                type="number"
                min={0}
                step={1}
                value={form.stock}
                onChange={event => setField('stock', event.target.value)}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Minimum Stock</label>
              <input
                type="number"
                min={0}
                step={1}
                value={form.minStock}
                onChange={event => setField('minStock', event.target.value)}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Cost per Unit (ETB)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.costPerUnit}
                onChange={event => setField('costPerUnit', event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Expiry Date *</label>
              <input
                type="date"
                required
                value={form.expiryDate}
                onChange={event => setField('expiryDate', event.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <input
                value={form.supplier}
                onChange={event => setField('supplier', event.target.value)}
                placeholder="e.g. Ethio Pharma Distributor"
                maxLength={150}
              />
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)', marginBottom: '1rem' }}>
            Recorded as added by <strong>{currentUser?.name || 'signed-in pharmacist'}</strong>.
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <LoadingButton type="submit" className="btn btn-primary" loading={saving} loadingLabel="Saving…">
              <CheckCircle2 size={16} /> Add Medicine
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}
