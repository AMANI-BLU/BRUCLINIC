import React, { useState } from 'react';
import { useClinic } from '../../context/ClinicContext';
import type { LabOrder } from '../../types';
import {
  FlaskConical, CheckCircle2, Clock, AlertTriangle, X,
  Microscope, Sparkles
} from 'lucide-react';

const LAB_EQUIPMENT = [
  { name: 'Hematology Analyzer (5-Part Diff)', model: 'Mindray BC-5000', status: 'Online / Calibrated', testsToday: 28 },
  { name: 'Clinical Chemistry Auto-Analyzer', model: 'Cobas c311', status: 'Online / Calibrated', testsToday: 19 },
  { name: 'Fluorescence Microscopy Station', model: 'Olympus BX53', status: 'Active (Malaria Smear)', testsToday: 14 },
  { name: 'Centrifuge & Serology Unit', model: 'Eppendorf 5702', status: 'Ready', testsToday: 32 },
];

export default function LaboratoryDashboard() {
  const { labOrders, updateLabOrder } = useClinic();

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [resultModal, setResultModal] = useState<LabOrder | null>(null);

  // Result entry form state
  const [resultValue, setResultValue] = useState('');
  const [unit, setUnit] = useState('');
  const [referenceRange, setReferenceRange] = useState('');
  const [isAbnormal, setIsAbnormal] = useState(false);
  const [notes, setNotes] = useState('');

  const pendingTests = labOrders.filter(o => o.status !== 'Completed');
  const completedTests = labOrders.filter(o => o.status === 'Completed');
  const criticalResults = labOrders.filter(o => o.isAbnormal);

  const filteredOrders = labOrders.filter(o => {
    const matchCat = filterCategory === 'All' || o.category === filterCategory;
    const matchSearch = o.patientName.toLowerCase().includes(search.toLowerCase()) ||
      o.testName.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleOpenResultEntry = (order: LabOrder) => {
    setResultModal(order);
    setResultValue(order.result || '');
    setUnit(order.unit || (order.category === 'Hematology' ? 'g/dL' : order.category === 'Biochemistry' ? 'mg/dL' : ''));
    setReferenceRange(order.referenceRange || 'Normal Range');
    setIsAbnormal(order.isAbnormal || false);
    setNotes(order.notes || '');
  };

  const handleSaveResult = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resultModal) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    updateLabOrder(resultModal.id, {
      status: 'Completed',
      result: resultValue,
      unit,
      referenceRange,
      isAbnormal,
      notes,
      completedAt: time,
    });

    setResultModal(null);
  };

  const handleAdvanceStatus = (order: LabOrder) => {
    if (order.status === 'Requested') {
      updateLabOrder(order.id, { status: 'Sample Collected' });
    } else if (order.status === 'Sample Collected') {
      updateLabOrder(order.id, { status: 'Analyzing' });
    } else if (order.status === 'Analyzing') {
      handleOpenResultEntry(order);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(28, 16, 52, 0.95) 0%, rgba(42, 22, 75, 0.88) 50%, rgba(20, 12, 40, 0.95) 100%)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: 16,
        padding: '1.75rem 2rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Ambient background glow */}
        <div style={{
          position: 'absolute', top: -30, right: -20, width: 260, height: 260,
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.18) 0%, transparent 70%)',
          pointerEvents: 'none', filter: 'blur(35px)'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '0.3rem 0.75rem', borderRadius: 99,
              background: 'rgba(139, 92, 246, 0.18)', border: '1px solid rgba(139, 92, 246, 0.4)',
              color: '#c4b5fd', fontSize: '0.74rem', fontWeight: 700,
              letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '0.65rem'
            }}>
              <FlaskConical size={14} /> Clinical Pathology &amp; Diagnostic Laboratory
            </div>
            <h1 style={{
              fontSize: '1.85rem', fontWeight: 900, fontFamily: 'var(--font-heading)',
              color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '0.35rem'
            }}>
              Diagnostic Testing &amp; Results Verification
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', fontWeight: 500 }}>
              Track specimen collection, process laboratory tests, flag critical abnormal values, and release reports.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span className="badge badge-violet" style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem', fontWeight: 700 }}>
              <Clock size={14} /> {pendingTests.length} Tests in Progress
            </span>
          </div>
        </div>
      </div>

      {/* Laboratory KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="stat-card" style={{ borderColor: 'rgba(139,92,246,0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
            <FlaskConical size={22} />
          </div>
          <div>
            <div className="stat-value">{pendingTests.length}</div>
            <div className="stat-label">Pending Lab Requests</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>From OPD &amp; Emergency</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="stat-value">{completedTests.length}</div>
            <div className="stat-label">Tests Completed Today</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>Released to doctors</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <div className="stat-value" style={{ color: '#ef4444' }}>{criticalResults.length}</div>
            <div className="stat-label">Critical Abnormal Flags</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>Urgent clinician alert</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(14,165,233,0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(14,165,233,0.15)', color: '#0ea5e9' }}>
            <Clock size={22} />
          </div>
          <div>
            <div className="stat-value">34 mins</div>
            <div className="stat-label">Avg. Turnaround Time</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>Sample to result release</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Orders Queue & Analyzer Equipment */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.25rem' }}>
        {/* Lab Orders Queue Table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FlaskConical size={18} className="text-primary" /> Active Diagnostic Test Queue
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)' }}>
                Specimen collection, analysis, and verification flow
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)', background: 'var(--clr-bg-card)', color: 'var(--clr-text-primary)', width: 140 }}
              />
              <select
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="All">All Categories</option>
                <option value="Parasitology">Parasitology (Malaria)</option>
                <option value="Hematology">Hematology</option>
                <option value="Biochemistry">Biochemistry</option>
                <option value="Urinalysis">Urinalysis</option>
              </select>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Patient</th>
                  <th>Test Name</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Result Summary</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--clr-text-muted)' }}>
                      No lab orders found matching current filter
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <span className="badge badge-blue">{o.id}</span>
                        <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>{o.orderedAt}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--clr-text-primary)' }}>{o.patientName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>Dr. {o.doctorName.split(' ')[1]}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>{o.testName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-secondary)' }}>{o.category} · {o.specimenType}</div>
                      </td>
                      <td>
                        <span className={`badge ${o.priority === 'Critical' ? 'badge-red' : o.priority === 'High' ? 'badge-amber' : 'badge-blue'}`}>
                          {o.priority}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          o.status === 'Completed' ? 'badge-green' :
                          o.status === 'Analyzing' ? 'badge-violet' :
                          o.status === 'Sample Collected' ? 'badge-blue' : 'badge-amber'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td>
                        {o.result ? (
                          <div style={{ fontSize: '0.8rem' }}>
                            <strong style={{ color: o.isAbnormal ? 'var(--clr-rose-400)' : 'var(--clr-emerald-400)' }}>
                              {o.result}
                            </strong>
                            {o.unit && <span style={{ color: 'var(--clr-text-muted)', marginLeft: 4 }}>{o.unit}</span>}
                            {o.isAbnormal && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--clr-rose-400)', fontWeight: 700 }}>
                                ABNORMAL
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {o.status !== 'Completed' ? (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleAdvanceStatus(o)}
                          >
                            {o.status === 'Requested' ? 'Collect Specimen' :
                             o.status === 'Sample Collected' ? 'Analyze' : 'Enter Results'}
                          </button>
                        ) : (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenResultEntry(o)}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lab Instruments & Calibrations Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem' }}>
              <Microscope size={16} className="text-primary" /> Laboratory Instruments Status
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {LAB_EQUIPMENT.map((eq, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--clr-bg-surface)',
                    border: '1px solid var(--clr-border)',
                    borderRadius: 8,
                    padding: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--clr-text-primary)' }}>
                      {eq.name}
                    </span>
                    <span className="badge badge-green" style={{ fontSize: '0.68rem' }}>
                      Active
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)', marginTop: 2 }}>
                    {eq.model} · {eq.status}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--clr-primary-400)', marginTop: 4 }}>
                    {eq.testsToday} specimens processed today
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ borderColor: 'rgba(59,130,246,0.25)' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} className="text-primary" /> Borana Zone Quality Standards
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)', lineHeight: 1.6 }}>
              All malaria blood films cross-checked with Giemsa stain standard. Critical chemistry panic values (e.g. RBS &gt; 350 mg/dL or &lt; 50 mg/dL) automatically generate an immediate notification to the on-duty emergency clinician.
            </p>
          </div>
        </div>
      </div>

      {/* Result Entry Modal */}
      {resultModal && (
        <div className="modal-overlay" onClick={() => setResultModal(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FlaskConical size={18} className="text-primary" /> Enter &amp; Verify Lab Results: {resultModal.testName}
              </h2>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setResultModal(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveResult}>
              <div style={{ background: 'rgba(59,130,246,0.06)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--clr-text-primary)' }}>
                  Patient: {resultModal.patientName} (ID: {resultModal.patientId})
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)', marginTop: 2 }}>
                  Requested by: {resultModal.doctorName} · Specimen: {resultModal.specimenType} ({resultModal.category})
                </div>
              </div>

              <div className="form-grid" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Measured Result Value *</label>
                  <input
                    required
                    value={resultValue}
                    onChange={(e) => setResultValue(e.target.value)}
                    placeholder="e.g. Positive (+), 13.5, 420, Clear, etc."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Measurement Unit</label>
                  <input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="e.g. mg/dL, g/dL, %, cells/mcL"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Normal Reference Range</label>
                  <input
                    value={referenceRange}
                    onChange={(e) => setReferenceRange(e.target.value)}
                    placeholder="e.g. 70 - 140 mg/dL, Negative"
                  />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isAbnormal}
                      onChange={(e) => setIsAbnormal(e.target.checked)}
                    />
                    <span style={{ fontWeight: 700, color: isAbnormal ? 'var(--clr-rose-400)' : 'var(--clr-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={15} /> Flag as Critical / Abnormal
                    </span>
                  </label>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Laboratory Technologist Remarks / Interpretation</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional diagnostic observations or critical clinician alerts..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setResultModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <CheckCircle2 size={16} /> Verify &amp; Transmit Results to Doctor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
