import { useState } from 'react';
import { useClinic } from '../context/ClinicContext';
import { Search, AlertTriangle, Plus, Minus, Package, TrendingDown } from 'lucide-react';

export default function Pharmacy() {
  const { medicines, updateMedicineStock } = useClinic();
  const [search, setSearch] = useState('');
  const [filterLow, setFilterLow] = useState(false);

  const filtered = medicines.filter(m => {
    const matchSearch = `${m.name} ${m.category} ${m.supplier}`.toLowerCase().includes(search.toLowerCase());
    const matchLow = !filterLow || m.stock <= m.minStock;
    return matchSearch && matchLow;
  });

  const lowCount = medicines.filter(m => m.stock <= m.minStock).length;
  const outCount = medicines.filter(m => m.stock === 0).length;
  const totalValue = medicines.reduce((sum, m) => sum + m.stock * m.costPerUnit, 0);

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
          <h1 className="page-title">Pharmacy & Inventory</h1>
          <p className="page-subtitle">{medicines.length} medicine types tracked</p>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div className="stat-card" style={{ borderColor: 'rgba(244,63,94,0.25)' }}>
          <div className="stat-icon" style={{ background: 'rgba(244,63,94,0.15)', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <div className="stat-value">{lowCount}</div>
            <div className="stat-label">Low Stock Items</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderColor: 'rgba(245,158,11,0.25)' }}>
          <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={22} />
          </div>
          <div>
            <div className="stat-value">{outCount}</div>
            <div className="stat-label">Out of Stock</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderColor: 'rgba(16,185,129,0.25)' }}>
          <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingDown size={22} />
          </div>
          <div>
            <div className="stat-value">{totalValue.toFixed(0)} ETB</div>
            <div className="stat-label">Inventory Value</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderColor: 'rgba(59,130,246,0.25)' }}>
          <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={22} />
          </div>
          <div>
            <div className="stat-value">{medicines.length}</div>
            <div className="stat-label">Total SKUs</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-bar">
          <Search size={16} className="icon" />
          <input id="pharma-search" placeholder="Search medicines…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button
          className={`btn ${filterLow ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterLow(f => !f)}
        >
          <AlertTriangle size={15} /> {filterLow ? 'Showing Low Stock' : 'Filter Low Stock'}
        </button>
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
              <th>Adjust</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => {
              const { label, cls } = stockLevel(m);
              const pct = stockPercent(m);
              return (
                <tr key={m.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{m.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>{m.unit}</div>
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
                  <td style={{ color: new Date(m.expiryDate) < new Date() ? 'var(--clr-rose-400)' : 'var(--clr-text-secondary)' }}>
                    {m.expiryDate}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)' }}>{m.supplier}</td>
                  <td><span className={`badge ${cls}`}>{label}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                      <button className="btn btn-danger btn-sm btn-icon" title="Dispense -1" onClick={() => updateMedicineStock(m.id, -1)}>
                        <Minus size={14} />
                      </button>
                      <button className="btn btn-success btn-sm btn-icon" title="Restock +10" onClick={() => updateMedicineStock(m.id, 10)}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
