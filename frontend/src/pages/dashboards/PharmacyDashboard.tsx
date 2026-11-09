import { useState } from 'react';
import { useClinic } from '../../context/ClinicContext';
import { useAuth } from '../../context/AuthContext';
import InfoBox from '../../components/AdminLTE/InfoBox';
import AddMedicineModal from '../../components/AddMedicineModal';
import ConfirmDispenseModal from '../../components/ConfirmDispenseModal';
import RestockMedicineModal from '../../components/RestockMedicineModal';
import type { MedicineItem, PharmacyOrder } from '../../types';
import { patientCodeFor, patientNameFor } from '../../utils/patient';
import { formatDateWithFallback } from '../../utils/date';
import {
  Pill, AlertTriangle, Package, CheckCircle2,
  Clock, Search, DollarSign, Plus, Printer
} from 'lucide-react';

export default function PharmacyDashboard() {
  const {
    pharmacyOrders, dispensePharmacyOrder,
    medicines, updateMedicine, patients
  } = useClinic();
  const { currentUser } = useAuth();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Pending' | 'Dispensed' | 'All'>('Pending');
  const [showAddMedicine, setShowAddMedicine] = useState(false);
  const [restockModal, setRestockModal] = useState<MedicineItem | null>(null);
  const [selectOrder, setSelectOrder] = useState<PharmacyOrder | null>(null);
  const [dispenseModal, setDispenseModal] = useState<PharmacyOrder | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const pendingOrders = pharmacyOrders.filter(p => p.status === 'Pending');
  const dispensedOrders = pharmacyOrders.filter(p => p.status === 'Dispensed');
  const lowStock = medicines.filter(m => m.stock <= m.minStock);
  const outOfStock = medicines.filter(m => m.stock === 0);
  const totalValue = medicines.reduce((sum, m) => sum + m.stock * m.costPerUnit, 0);

  const displayedOrders = pharmacyOrders.filter(p => {
    const matchStatus = statusFilter === 'All' || p.status === statusFilter;
    const matchSearch = p.patientName.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  /** Inventory entry for a prescribed line — used for the photo & attribution. */
  const inventoryMatch = (name: string, medicineId?: string) =>
    medicines.find(m => (medicineId && m.id === medicineId) || m.name.toLowerCase() === name.toLowerCase());

  const handleDispense = (orderOrId: PharmacyOrder | string) => {
    setSelectOrder(null);
    if (typeof orderOrId === 'string') {
      const order = pharmacyOrders.find(p => p.id === orderOrId) || null;
      setDispenseModal(order);
    } else {
      setDispenseModal(orderOrId);
    }
  };

  const confirmDispense = async (orderId: string, _medicineId?: string, _quantity?: number, overrides?: Record<string, string>, quantities?: Record<string, number>) => {
    try {
      await dispensePharmacyOrder(orderId, currentUser?.name || 'Pharmacy staff', overrides, quantities);
      setFormError(null);
      setDispenseModal(null);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not dispense this order.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Pharmacy queue status */}
      <div className="department-action-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="department-action-control">
            <span className="badge badge-blue" style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem', fontWeight: 700 }}>
              <Clock size={14} /> {pendingOrders.length} Prescriptions In Queue
            </span>
          </div>
          <div className="department-action-control">
            <button className="btn btn-primary" onClick={() => setShowAddMedicine(true)}>
              <Plus size={16} /> Add Medicine
            </button>
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
                <Pill size={18} className="text-primary" />
                {statusFilter === 'Dispensed' ? 'Dispensed Orders' : statusFilter === 'Pending' ? 'Live Electronic Prescription Queue' : 'All Prescription Orders'}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)' }}>
                {statusFilter === 'Dispensed'
                  ? 'Fulfilled prescriptions with the pharmacist who dispensed them'
                  : 'Direct clinical orders from consulting doctors'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
              <div className="pill-tabs" style={{ fontSize: '0.74rem' }}>
                {(['Pending', 'Dispensed', 'All'] as const).map(filter => (
                  <button
                    key={filter}
                    className={`pill-tab ${statusFilter === filter ? 'active' : ''}`}
                    onClick={() => setStatusFilter(filter)}
                  >
                    {filter} ({filter === 'Pending' ? pendingOrders.length : filter === 'Dispensed' ? dispensedOrders.length : pharmacyOrders.length})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {formError && !restockModal && (
            <div className="alert alert-danger py-2 px-3" role="alert" style={{ marginBottom: '0.875rem' }}>
              {formError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {displayedOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--clr-text-muted)', fontSize: '0.875rem' }}>
                {statusFilter === 'Dispensed'
                  ? 'No dispensed orders yet. Dispensed prescriptions will be listed here.'
                  : 'No prescriptions found matching filter.'}
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
                        {patientCodeFor(patients, order.patientId)} · Prescribed by: {order.doctorName} · {formatDateWithFallback(order.prescribedAt, order.createdAt)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      {order.medicines.some(m => m.isExternal) && (
                        <span className="badge badge-yellow" style={{ fontSize: '0.7rem' }}>
                          Buy Outside Items
                        </span>
                      )}
                      <span className={`badge ${order.status === 'Pending' ? 'badge-blue' : order.status === 'Dispensed' ? 'badge-green' : 'badge-gray'}`}>
                        {order.status}
                      </span>
                    </div>
                  </div>

                  {/* Medicines List in Order */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: '0.75rem 0' }}>
                    {order.medicines.map((med, idx) => {
                      const inventory = inventoryMatch(med.name, med.medicineId);
                      return (
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
                            gap: '0.75rem',
                            fontSize: '0.82rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
                              border: '1px solid var(--clr-border)', background: 'var(--clr-bg-hover)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {inventory?.imageUrl ? (
                                <img src={inventory.imageUrl} alt={med.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <Pill size={14} style={{ color: 'var(--clr-text-muted)' }} />
                              )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <strong style={{ color: 'var(--clr-text-primary)' }}>{med.name}</strong>
                              {med.isExternal && (
                                <span className="badge badge-yellow" style={{ fontSize: '0.65rem', marginLeft: 6 }}>
                                  Buy Outside
                                </span>
                              )}
                              <span style={{ color: 'var(--clr-text-muted)', marginLeft: 8 }}>
                                {med.instructions || 'Dose as directed by the prescriber'}
                              </span>
                              {inventory?.addedBy && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)', marginTop: 2 }}>
                                  Added to inventory by {inventory.addedBy}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="badge badge-blue">Qty: {med.quantity > 0 ? med.quantity : 'Pharmacist sets'}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--clr-border)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>
                      {order.status === 'Dispensed'
                        ? `Dispensed by ${order.dispensedBy || 'Pharmacy staff'} at ${order.dispensedAt}`
                        : 'Verify prescription before dispensing'}
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDispense(order.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <Printer size={13} /> Review &amp; Print Slip
                      </button>
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
                    gap: '0.6rem',
                    padding: '0.45rem 0.6rem',
                    borderRadius: 6,
                    border: '1px solid var(--clr-border)',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
                      border: '1px solid var(--clr-border)', background: 'var(--clr-bg-hover)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {m.imageUrl ? (
                        <img src={m.imageUrl} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Package size={14} style={{ color: 'var(--clr-text-muted)' }} />
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>{m.name}</span>
                      <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>
                        {m.category} · {m.costPerUnit} ETB/unit{m.addedBy ? ` · Added by ${m.addedBy}` : ''}
                      </div>
                    </div>
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
        <RestockMedicineModal
          medicine={restockModal}
          onClose={() => setRestockModal(null)}
          onRestock={async (additionalStock, updates) => {
            const currentItem = restockModal;
            await updateMedicine(currentItem.id, {
              stock: currentItem.stock + additionalStock,
              expiryDate: updates.expiryDate,
              supplier: updates.supplier,
              costPerUnit: updates.costPerUnit,
            });
            setRestockModal(null);
          }}
        />
      )}

      {showAddMedicine && <AddMedicineModal onClose={() => setShowAddMedicine(false)} />}
      {(selectOrder || dispenseModal) && (
        <ConfirmDispenseModal
          order={selectOrder || dispenseModal}
          medicines={medicines}
          onSelect={confirmDispense}
          onClose={() => { setSelectOrder(null); setDispenseModal(null); }}
        />
      )}
    </div>
  );
}
