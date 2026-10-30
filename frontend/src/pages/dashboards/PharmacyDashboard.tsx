import React, { useState } from 'react';
import { useClinic } from '../../context/ClinicContext';
import InfoBox from '../../components/AdminLTE/InfoBox';
import type { MedicineItem } from '../../types';
import { validateNumber } from '../../utils/validation';
import { patientCodeFor, patientNameFor } from '../../utils/patient';
import {
  Pill, AlertTriangle, Package, CheckCircle2,
  Clock, Search, X, DollarSign, Plus
} from 'lucide-react';

export default function PharmacyDashboard() {
  const {
    pharmacyOrders, dispensePharmacyOrder,
    medicines, updateMedicineStock, patients
  } = useClinic();

  const [search, setSearch] = useState('');
  const [filterPending, setFilterPending] = useState(true);
  const [restockModal, setRestockModal] = useState<MedicineItem | null>(null);
  const [restockAmount, setRestockAmount] = useState(100);
  const [formError, setFormError] = useState<string | null>(null);

  const pendingOrders = pharmacyOrders.filter(p => p.status === 'Pending');
  const dispensedOrders = pharmacyOrders.filter(p => p.status === 'Dispensed');
  const lowStock = medicines.filter(m => m.stock <= m.minStock);
  const outOfStock = medicines.filter(m => m.stock === 0);
  const totalValue = medicines.reduce((sum, m) => sum + m.stock * m.costPerUnit, 0);

  const displayedOrders = pharmacyOrders.filter(p => {
    const matchStatus = !filterPending || p.status === 'Pending';
    const matchSearch = p.patientName.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleDispense = (orderId: string) => {
    dispensePharmacyOrder(orderId, 'Pharm. Hawi Tadesse');
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockModal) return;
    const numericError = validateNumber(String(restockAmount), 'Quantity', { min: 1, integer: true });
    if (numericError) {
      setFormError(numericError);
      return;
    }
    try {
      await updateMedicineStock(restockModal.id, Number(restockAmount));
      setFormError(null);
      setRestockModal(null);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not update stock.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Pharmacy queue status */}
      <div className="department-action-row">
          <div className="department-action-control">
            <span className="badge badge-blue" style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem', fontWeight: 700 }}>
              <Clock size={14} /> {pendingOrders.length} Prescriptions In Queue
            </span>
          </div>
      </div>

      {/* Pharmacy KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <InfoBox tone="info" icon={<Pill size={22} />} value={pendingOrders.length} label="Pending Dispenses" detail="From OPD and Emergency" />
        <InfoBox tone="danger" icon={<AlertTriangle size={22} />} value={lowStock.length} label="Low Stock Warnings" detail={`${outOfStock.length} completely empty`} />
        <InfoBox tone="success" icon={<CheckCircle2 size={22} />} value={dispensedOrders.length} label="Dispensed Orders" detail="Fulfilled prescriptions" />
        <InfoBox tone="primary" icon={<DollarSign size={22} />} value={`${totalValue.toFixed(0)} ETB`} label="Total Drug Inventory" detail={`${medicines.length} tracked items`} />
      </div>

      {/* Main Grid: Live Prescriptions & Stock Monitor */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.25rem' }}>
        {/* Prescription Queue */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Pill size={18} className="text-primary" /> Live Electronic Prescription Queue
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)' }}>
                Direct clinical orders from consulting doctors
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={14} style={{ position: 'absolute', left: 8, color: 'var(--clr-text-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem 0.35rem 1.7rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)', background: 'var(--clr-bg-card)', color: 'var(--clr-text-primary)', width: 140 }}
                />
              </div>
              <button
                className={`btn btn-sm ${filterPending ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterPending(!filterPending)}
              >
                {filterPending ? 'Showing Pending' : 'All Prescriptions'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {displayedOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--clr-text-muted)', fontSize: '0.875rem' }}>
                No prescriptions found matching filter.
              </div>
            ) : (
              displayedOrders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    background: 'var(--clr-bg-surface)',
                    border: '1px solid var(--clr-border)',
                    borderRadius: 10,
                    padding: '1.1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="badge badge-blue">{order.id}</span>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--clr-text-primary)' }}>
                          {patientNameFor(patients, order.patientId, order.patientName)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)', marginTop: 2 }}>
                        {patientCodeFor(patients, order.patientId)} · Prescribed by: {order.doctorName} · {order.prescribedAt}
                      </div>
                    </div>
                    <span className={`badge ${order.status === 'Pending' ? 'badge-blue' : 'badge-gray'}`}>
                      {order.status}
                    </span>
                  </div>

                  {/* Medicines List in Order */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: '0.75rem 0' }}>
                    {order.medicines.map((med, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          borderRadius: 6,
                          padding: '0.5rem 0.75rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.82rem',
                        }}
                      >
                        <div>
                          <strong style={{ color: 'var(--clr-text-primary)' }}>{med.name}</strong>
                          <span style={{ color: 'var(--clr-text-muted)', marginLeft: 8 }}>
                            {med.dosage} ({med.frequency}, {med.duration})
                          </span>
                        </div>
                        <span className="badge badge-blue">Qty: {med.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--clr-border)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>
                      {order.status === 'Dispensed' ? `Dispensed by ${order.dispensedBy} at ${order.dispensedAt}` : 'Verify dosage before dispensing'}
                    </span>
                    {order.status === 'Pending' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleDispense(order.id)}
                      >
                        <CheckCircle2 size={14} /> Dispense &amp; Deduct Stock
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low Stock & Inventory Overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Low Stock Alerts Card */}
          <div className="card" style={{ borderColor: 'rgba(244,63,94,0.3)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--clr-rose-400)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem' }}>
              <AlertTriangle size={16} /> Critical Stock &amp; Reorder Alerts
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {lowStock.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)' }}>
                  All medicine stock levels are currently adequate.
                </div>
              ) : (
                lowStock.map(med => (
                  <div
                    key={med.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(244,63,94,0.06)',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{med.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>
                        Current: <strong>{med.stock} {med.unit}</strong> (Min: {med.minStock})
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.72rem' }}
                      onClick={() => setRestockModal(med)}
                    >
                      + Reorder
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Drug Lookup */}
          <div className="card">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem' }}>
              <Package size={16} className="text-primary" /> Medicine Inventory Lookup
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 320, overflowY: 'auto' }}>
              {medicines.map(m => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.45rem 0.6rem',
                    borderRadius: 6,
                    border: '1px solid var(--clr-border)',
                    fontSize: '0.8rem',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>{m.name}</span>
                    <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>{m.category} · {m.costPerUnit} ETB/unit</div>
                  </div>
                  <span className={`badge ${m.stock === 0 ? 'badge-red' : m.stock <= m.minStock ? 'badge-red' : 'badge-blue'}`}>
                    {m.stock} {m.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Restock Modal */}
      {restockModal && (
        <div className="modal-overlay" onClick={() => setRestockModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={16} className="text-primary" /> Restock Medicine: {restockModal.name}
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setRestockModal(null)}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit}>
              {formError && <div className="alert alert-danger py-2 px-3" role="alert">{formError}</div>}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Quantity to Add ({restockModal.unit})</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(Number(e.target.value))}
                />
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)', marginBottom: '1rem' }}>
                Supplier: {restockModal.supplier} · Current Stock: {restockModal.stock} {restockModal.unit}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRestockModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <CheckCircle2 size={16} /> Confirm Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
