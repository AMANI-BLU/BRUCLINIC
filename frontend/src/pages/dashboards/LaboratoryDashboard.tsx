import React, { useState } from 'react';
import { useClinic } from '../../context/ClinicContext';
import InfoBox from '../../components/AdminLTE/InfoBox';
import type { LabOrder } from '../../types';
import { firstError, validateRequired } from '../../utils/validation';
import { patientCodeFor, patientNameFor } from '../../utils/patient';
import { FlaskConical, CheckCircle2, Clock, AlertTriangle, X } from 'lucide-react';

export default function LaboratoryDashboard() {
  const { labOrders, patients, updateLabOrder } = useClinic();

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [resultModal, setResultModal] = useState<LabOrder | null>(null);

  // Result entry form state
  const [resultValue, setResultValue] = useState('');
  const [unit, setUnit] = useState('');
  const [referenceRange, setReferenceRange] = useState('');
  const [isAbnormal, setIsAbnormal] = useState(false);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

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
    setFormError(null);
  };

  const handleSaveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resultModal) return;
    const error = firstError(...Object.values(validateRequired({ resultValue }, { resultValue: 'Result value' })));
    if (error) {
      setFormError(error);
      return;
    }

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      await updateLabOrder(resultModal.id, {
        status: 'Completed',
        result: resultValue,
        unit,
        referenceRange,
        isAbnormal,
        notes,
        completedAt: time,
      });
      setFormError(null);
      setResultModal(null);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not save the laboratory result.');
    }
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
      {/* Laboratory queue status */}
      <div className="department-action-row">
          <div className="department-action-control">
            <span className="badge badge-blue" style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem', fontWeight: 700 }}>
              <Clock size={14} /> {pendingTests.length} Tests in Progress
            </span>
          </div>
      </div>

      {/* Laboratory KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <InfoBox tone="info" icon={<FlaskConical size={22} />} value={pendingTests.length} label="Pending Lab Requests" detail="From OPD and Emergency" />
        <InfoBox tone="success" icon={<CheckCircle2 size={22} />} value={completedTests.length} label="Completed Tests" detail="Released to doctors" />
        <InfoBox tone="danger" icon={<AlertTriangle size={22} />} value={criticalResults.length} label="Critical Abnormal Flags" detail="Urgent clinician alert" />
        <InfoBox tone="primary" icon={<Clock size={22} />} value={labOrders.filter(order => order.status === 'Analyzing').length} label="Tests In Analysis" detail="Live laboratory queue" />
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
                        <div style={{ fontWeight: 700, color: 'var(--clr-text-primary)' }}>{patientNameFor(patients, o.patientId, o.patientName)}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>{patientCodeFor(patients, o.patientId)} · Dr. {o.doctorName.split(' ')[1]}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>{o.testName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-secondary)' }}>{o.category} · {o.specimenType}</div>
                      </td>
                      <td>
                        <span className={`badge ${o.priority === 'Critical' ? 'badge-red' : 'badge-gray'}`}>
                          {o.priority}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          o.status === 'Completed' ? 'badge-blue' :
                          o.status === 'Sample Collected' ? 'badge-blue' : 'badge-gray'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td>
                        {o.result ? (
                          <div style={{ fontSize: '0.8rem' }}>
                            <strong style={{ color: o.isAbnormal ? 'var(--clr-rose-500)' : 'var(--clr-primary-400)' }}>
                              {o.result}
                            </strong>
                            {o.unit && <span style={{ color: 'var(--clr-text-muted)', marginLeft: 4 }}>{o.unit}</span>}
                            {o.isAbnormal && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--clr-rose-500)', fontWeight: 700 }}>
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

        {/* Laboratory reference information */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>Laboratory instruments</h3>
            <div className="callout callout-info mb-0">
              Instrument records are not available in the connected database yet.
            </div>
          </div>

          <div className="card card-outline card-info">
            <h4 className="card-title mb-2">Connected data</h4>
            <p className="text-muted mb-0">Only laboratory orders and results loaded from the connected database are shown here.</p>
          </div>
        </div>
      </div>

      {/* Result Entry Modal */}
      {resultModal && (
        <div className="modal-overlay" onClick={() => setResultModal(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.96rem' }}>
                <FlaskConical size={16} className="text-primary" /> Lab Results: {resultModal.testName}
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setResultModal(null)}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveResult}>
              {formError && <div className="alert alert-danger py-2 px-3" role="alert">{formError}</div>}
              <div style={{ background: 'rgba(59,130,246,0.06)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--clr-text-primary)' }}>
                  Patient: {patientNameFor(patients, resultModal.patientId, resultModal.patientName)} (ID: {patientCodeFor(patients, resultModal.patientId)})
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

              <div style={{
                background: 'rgba(37, 99, 235, 0.08)',
                border: '1px solid var(--clr-primary-400)',
                borderRadius: 8,
                padding: '0.65rem 0.85rem',
                fontSize: '0.76rem',
                color: 'var(--clr-primary-400)',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <CheckCircle2 size={16} /> Verifying these results will automatically advance the patient back to OPD Doctor Consultation with "Lab Results Ready".
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setResultModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <CheckCircle2 size={16} /> Verify &amp; Return Results to OPD Doctor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
