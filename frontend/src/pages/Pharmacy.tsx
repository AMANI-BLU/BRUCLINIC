import { useState } from 'react';
import { useClinic } from '../context/ClinicContext';
import { useAuth } from '../context/AuthContext';
import InfoBox from '../components/AdminLTE/InfoBox';
import AddMedicineModal from '../components/AddMedicineModal';
import AdjustMedicineStockModal from '../components/AdjustMedicineStockModal';
import { Search, AlertTriangle, Plus, Package, TrendingDown, SlidersHorizontal, Clock, ShieldAlert, ClipboardList, Download, Printer, X, CheckCircle2 } from 'lucide-react';
import ModalPortal from '../components/ModalPortal';
import './Pharmacy.css';

export default function Pharmacy() {
  const { medicines, updateMedicineStock } = useClinic();
  const { role } = useAuth();
  const canManageInventory = role === 'pharmacy';
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'lowStock' | 'expiringSoon' | 'expired'>('all');
  const [showAddMedicine, setShowAddMedicine] = useState(false);
  const [showExpiryReport, setShowExpiryReport] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<(typeof medicines)[number] | null>(null);

  const now = new Date();
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(now.getDate() + 90);

  const isExpired = (expiry: string) => Boolean(expiry && new Date(expiry) < now);
  const isExpiringSoon = (expiry: string) => {
    if (!expiry) return false;
    const d = new Date(expiry);
    return d >= now && d <= ninetyDaysFromNow;
  };

  const getDaysUntilExpiry = (expiry: string) => {
    if (!expiry) return 0;
    const diff = new Date(expiry).getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const expiringCount = medicines.filter(m => isExpiringSoon(m.expiryDate)).length;
  const expiredCount = medicines.filter(m => isExpired(m.expiryDate)).length;
  const lowCount = medicines.filter(m => m.stock <= m.minStock).length;
  const outCount = medicines.filter(m => m.stock === 0).length;
  const totalValue = medicines.reduce((sum, m) => sum + m.stock * m.costPerUnit, 0);
  const expiryRows = medicines
    .filter(m => isExpired(m.expiryDate) || isExpiringSoon(m.expiryDate))
    .map(m => ({
      ...m,
      expired: isExpired(m.expiryDate),
      daysLeft: getDaysUntilExpiry(m.expiryDate),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
  const expiryValueAtRisk = expiryRows.reduce((sum, m) => sum + m.stock * m.costPerUnit, 0);

  const downloadExpiryReport = () => {
    const header = ['Medicine', 'Category', 'Supplier', 'Stock', 'Unit', 'Best Before', 'Days To Best Before', 'Status', 'Value (ETB)'];
    const lines = expiryRows.map(m => [
      m.name,
      m.category,
      m.supplier,
      String(m.stock),
      m.unit,
      m.expiryDate,
      String(m.daysLeft),
      m.expired ? 'Expired / Past BB' : 'Expiring Soon',
      (m.stock * m.costPerUnit).toFixed(2),
    ]);
    const csv = [header, ...lines]
      .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `best-before-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const filtered = medicines.filter(m => {
    const matchSearch = `${m.name} ${m.category} ${m.supplier}`.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filterMode === 'lowStock') return m.stock <= m.minStock;
    if (filterMode === 'expiringSoon') return isExpiringSoon(m.expiryDate);
    if (filterMode === 'expired') return isExpired(m.expiryDate);
    return true;
  });

  const stockLevel = (m: typeof medicines[0]) => {
    if (m.stock === 0) return { label: 'Out of Stock', cls: 'badge-red' };
    if (m.stock <= m.minStock) return { label: 'Low Stock', cls: 'badge-amber' };
    return { label: 'In Stock', cls: 'badge-green' };
  };

  const stockPercent = (m: typeof medicines[0]) =>
    Math.min(100, Math.round((m.stock / (m.minStock * 4)) * 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pharmacy &amp; Inventory</h1>
          <p className="page-subtitle">{medicines.length} medicine types tracked · Best Before &amp; Expiry monitoring active</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setShowExpiryReport(true)}>
            <ClipboardList size={16} /> Best Before Report
          </button>
          {canManageInventory && (
            <button className="btn btn-primary" onClick={() => setShowAddMedicine(true)}>
              <Plus size={16} /> Add Medicine
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <InfoBox tone="danger" icon={<AlertTriangle size={22} />} value={lowCount} label="Low Stock Items" detail={`${outCount} out of stock`} />
        <InfoBox tone="warning" icon={<Clock size={22} />} value={expiringCount} label="Expiring Soon (< 90d)" detail={`${expiredCount} past best-before`} />
        <InfoBox tone="success" icon={<TrendingDown size={22} />} value={`${totalValue.toFixed(0)} ETB`} label="Inventory Value" />
        <InfoBox tone="info" icon={<Package size={22} />} value={medicines.length} label="Total SKUs Tracked" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div className="search-bar" style={{ minWidth: 260 }}>
          <Search size={16} className="icon" />
          <input id="pharma-search" placeholder="Search medicines by name, category, supplier…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="pill-tabs" style={{ fontSize: '0.78rem' }}>
          <button
            type="button"
            className={`pill-tab ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            All Items ({medicines.length})
          </button>
          <button
            type="button"
            className={`pill-tab ${filterMode === 'lowStock' ? 'active' : ''}`}
            onClick={() => setFilterMode('lowStock')}
          >
            Low Stock ({lowCount})
          </button>
          <button
            type="button"
            className={`pill-tab ${filterMode === 'expiringSoon' ? 'active' : ''}`}
            onClick={() => setFilterMode('expiringSoon')}
          >
            Expiring Soon ({expiringCount})
          </button>
          <button
            type="button"
            className={`pill-tab ${filterMode === 'expired' ? 'active' : ''}`}
            onClick={() => setFilterMode('expired')}
          >
            Expired / Past BB ({expiredCount})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Category</th>
              <th>Stock Level</th>
              <th>Stock</th>
              <th>Min. Required</th>
              <th>Expiry</th>
              <th>Supplier</th>
              <th>Status</th>
              {canManageInventory && <th>Adjust stock</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => {
              const { label, cls } = stockLevel(m);
              const pct = stockPercent(m);
              return (
                <tr key={m.id}>
                  <td>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
                        border: '1px solid var(--clr-border)', background: 'var(--clr-bg-hover)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {m.imageUrl ? (
                          <img src={m.imageUrl} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Package size={16} style={{ color: 'var(--clr-text-muted)' }} />
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{m.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>
                          {m.unit}{m.addedBy ? ` · Added by ${m.addedBy}` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge badge-violet">{m.category}</span></td>
                  <td style={{ minWidth: 120 }}>
                    <div style={{ height: 6, background: 'var(--clr-bg-hover)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`, borderRadius: 99,
                        background: m.stock === 0 ? '#f43f5e' : m.stock <= m.minStock ? '#f59e0b' : '#10b981',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)', marginTop: '0.2rem' }}>{pct}%</div>
                  </td>
                  <td style={{ fontWeight: 700, fontSize: '1rem', color: m.stock <= m.minStock ? 'var(--clr-rose-400)' : 'var(--clr-text-primary)' }}>
                    {m.stock}
                  </td>
                  <td style={{ color: 'var(--clr-text-muted)' }}>{m.minStock}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: isExpired(m.expiryDate) ? 'var(--clr-rose-500)' : 'var(--clr-text-primary)' }}>
                      {m.expiryDate}
                    </div>
                    {isExpired(m.expiryDate) ? (
                      <span className="badge badge-red" style={{ fontSize: '0.66rem', marginTop: 2 }}>
                        <ShieldAlert size={10} /> Expired (BB Passed)
                      </span>
                    ) : isExpiringSoon(m.expiryDate) ? (
                      <span className="badge badge-amber" style={{ fontSize: '0.66rem', marginTop: 2 }}>
                        <Clock size={10} /> BB: {getDaysUntilExpiry(m.expiryDate)}d left
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>
                        Valid
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)' }}>{m.supplier}</td>
                  <td><span className={`badge ${cls}`}>{label}</span></td>
                  {canManageInventory && (
                    <td>
                      <button type="button" className="btn btn-secondary btn-sm pharmacy-adjust-trigger" onClick={() => setAdjustTarget(m)}>
                        <SlidersHorizontal size={14} /> Adjust stock
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showExpiryReport && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setShowExpiryReport(false)}>
            <div className="modal pharmacy-report-modal" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="expiry-report-title">
              <div className="modal-header pharmacy-report-toolbar no-print">
                <div>
                  <h2 id="expiry-report-title" className="modal-title"><ClipboardList size={17} /> Best Before &amp; Expiry Report</h2>
                  <p className="pharmacy-report-subtitle">Medicines that are expired or reach best-before within 90 days.</p>
                </div>
                <div className="pharmacy-report-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={downloadExpiryReport}>
                    <Download size={14} /> Download CSV
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
                    <Printer size={14} /> Print / Save PDF
                  </button>
                  <button type="button" className="modal-close-btn" onClick={() => setShowExpiryReport(false)} aria-label="Close report">
                    <X size={17} />
                  </button>
                </div>
              </div>

              <div className="pharmacy-expiry-report-sheet">
                <header className="pharmacy-report-sheet-head">
                  <div>
                    <h1>Borana University Clinic</h1>
                    <p>Pharmacy Best Before &amp; Expiry Report</p>
                  </div>
                  <div className="pharmacy-report-sheet-meta">
                    <span>Generated</span>
                    <strong>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                  </div>
                </header>

                <div className="pharmacy-report-summary">
                  <div><span>Expired / Past BB</span><strong>{expiredCount}</strong></div>
                  <div><span>Expiring within 90 days</span><strong>{expiringCount}</strong></div>
                  <div><span>Units at risk</span><strong>{expiryRows.reduce((sum, m) => sum + m.stock, 0)}</strong></div>
                  <div><span>Estimated value at risk</span><strong>{expiryValueAtRisk.toFixed(2)} ETB</strong></div>
                </div>

                {expiryRows.length === 0 ? (
                  <div className="pharmacy-report-empty">
                    <CheckCircle2 size={22} />
                    <div><strong>No expired or expiring medicines</strong><span>All tracked medicines are outside the 90-day best-before window.</span></div>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="pharmacy-report-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Medicine</th>
                          <th>Category</th>
                          <th>Supplier</th>
                          <th>Stock</th>
                          <th>Best Before</th>
                          <th>Days Left</th>
                          <th>Status</th>
                          <th>Value (ETB)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expiryRows.map((m, index) => (
                          <tr key={m.id} className={m.expired ? 'pharmacy-report-row-expired' : 'pharmacy-report-row-soon'}>
                            <td>{index + 1}</td>
                            <td><strong>{m.name}</strong><div className="pharmacy-report-unit">{m.unit}</div></td>
                            <td>{m.category}</td>
                            <td>{m.supplier}</td>
                            <td><strong>{m.stock}</strong> {m.unit}</td>
                            <td>{m.expiryDate}</td>
                            <td>{m.daysLeft < 0 ? `${Math.abs(m.daysLeft)} days overdue` : `${m.daysLeft} days`}</td>
                            <td>
                              <span className={`badge ${m.expired ? 'badge-red' : 'badge-amber'}`}>
                                {m.expired ? <ShieldAlert size={10} /> : <Clock size={10} />}
                                {m.expired ? 'Expired / Past BB' : 'Expiring Soon'}
                              </span>
                            </td>
                            <td>{(m.stock * m.costPerUnit).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <footer className="pharmacy-report-sheet-footer">
                  <span>Prepared by the Clinic Pharmacy · Borana University Health Services</span>
                  <span className="pharmacy-report-sign-line">Pharmacist signature / stamp</span>
                </footer>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {adjustTarget && (
        <AdjustMedicineStockModal
          medicine={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onAdjust={async delta => { await updateMedicineStock(adjustTarget.id, delta); }}
        />
      )}
      {showAddMedicine && <AddMedicineModal onClose={() => setShowAddMedicine(false)} />}
    </div>
  );
}
