import React, { useState } from 'react';
import { useClinic } from '../../context/ClinicContext';
import InfoBox from '../../components/AdminLTE/InfoBox';
import type { LabOrder } from '../../types';
import { firstError, validateRequired } from '../../utils/validation';
import { patientCodeFor, patientNameFor } from '../../utils/patient';
import { findStandardLabTest, type StandardLabTest } from '../../utils/labPresets';
import {
  FlaskConical, CheckCircle2, Clock, AlertTriangle, X,
  Printer, Sparkles
} from 'lucide-react';
import './LaboratoryDashboard.css';
import ModalPortal from '../../components/ModalPortal';

const workflowSteps: LabOrder['status'][] = ['Requested', 'Sample Collected', 'Analyzing', 'Completed'];

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
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
  const [activeStandardTest, setActiveStandardTest] = useState<StandardLabTest | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const pendingTests = labOrders.filter(o => o.status !== 'Completed');
  const completedTests = labOrders.filter(o => o.status === 'Completed');
  const criticalResults = labOrders.filter(o => o.isAbnormal);
  const categories = [...new Set(labOrders.map(order => order.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const filteredOrders = labOrders.filter(o => {
    const matchCat = filterCategory === 'All' || o.category === filterCategory;
    const matchSearch = o.patientName.toLowerCase().includes(search.toLowerCase()) ||
      o.testName.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleOpenResultEntry = (order: LabOrder) => {
    const standard = findStandardLabTest(order.testName);
    setActiveStandardTest(standard || null);
    setResultModal(order);
    setResultValue(order.result || '');
    setUnit(order.unit || standard?.defaultUnit || (order.category === 'Hematology' ? 'g/dL' : order.category === 'Biochemistry' ? 'mg/dL' : ''));
    setReferenceRange(order.referenceRange || standard?.defaultRefRange || 'Normal Range');
    setIsAbnormal(order.isAbnormal || false);
    setNotes(order.notes || '');
    setParameterValues({});
    setFormError(null);
  };

  const handleQuickResultFill = (val: string, abnormal = false) => {
    setResultValue(val);
    setIsAbnormal(abnormal);
  };

  const handleParameterChange = (paramName: string, val: string) => {
    const next = { ...parameterValues, [paramName]: val };
    setParameterValues(next);

    // Auto-compose overall result value from parameter breakdown
    const parts = Object.entries(next)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => `${k.replace(/\s*\(.*?\)\s*/g, '')}: ${v}`);
    if (parts.length > 0) {
      setResultValue(parts.join(' | '));
    }
  };

  const handleSaveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resultModal) return;
    const error = firstError(...Object.values(validateRequired({ resultValue }, { resultValue: 'Diagnostic result' })));
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

  const handlePrintReport = (order: LabOrder) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lab Report - ${order.patientName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #111; }
          .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: 800; color: #1e3a8a; }
          .subtitle { font-size: 13px; color: #555; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; margin-bottom: 20px; background: #f8fafc; padding: 12px; border-radius: 6px; }
          .result-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; margin-bottom: 20px; }
          .result-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
          .result-val { font-size: 18px; font-weight: 800; color: #0284c7; }
          .abnormal { color: #dc2626 !important; }
          .footer { font-size: 12px; color: #64748b; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">BORANA UNIVERSITY CLINIC &amp; HOSPITAL</div>
          <div class="subtitle">Clinical Diagnostic Pathology &amp; Medical Laboratory Report</div>
        </div>
        <div class="meta-grid">
          <div><strong>Patient:</strong> ${order.patientName}</div>
          <div><strong>Order ID:</strong> ${order.id}</div>
          <div><strong>Requesting Clinician:</strong> ${order.doctorName}</div>
          <div><strong>Specimen:</strong> ${order.specimenType} (${order.category})</div>
          <div><strong>Ordered:</strong> ${order.orderedAt}</div>
          <div><strong>Verified:</strong> ${order.completedAt || 'Completed today'}</div>
        </div>
        <div class="result-box">
          <div class="result-title">Investigation: ${order.testName}</div>
          <div class="result-val ${order.isAbnormal ? 'abnormal' : ''}">
            Measured Result: ${order.result} ${order.unit || ''}
            ${order.isAbnormal ? ' [CRITICAL / ABNORMAL FLAG]' : ' [NORMAL]'}
          </div>
          <div style="font-size: 13px; margin-top: 6px; color: #475569;">
            Reference Range: ${order.referenceRange || 'Standard normal'}
          </div>
          ${order.notes ? `<div style="font-size: 13px; margin-top: 10px; font-style: italic;">Remarks: ${order.notes}</div>` : ''}
        </div>
        <div class="footer">
          <div>Verified by Medical Laboratory Technologist on duty.</div>
          <div>This diagnostic document is generated directly from BruClinic Electronic Medical Records System.</div>
        </div>
        <script>window.print();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="lab-dashboard">
      {/* Laboratory queue status */}
      <div className="lab-queue-summary">
        <div className="lab-queue-count">
          <span className="lab-queue-count-icon"><Clock size={16} /></span>
          <span><strong>{pendingTests.length}</strong> tests in progress</span>
        </div>
        <span className="lab-queue-summary-copy">Move each order through collection, analysis, and verified reporting.</span>
      </div>

      {/* Laboratory KPIs */}
      <div className="lab-kpi-grid">
        <InfoBox tone="info" icon={<FlaskConical size={22} />} value={pendingTests.length} label="Pending Lab Requests" detail="From OPD and Emergency" />
        <InfoBox tone="success" icon={<CheckCircle2 size={22} />} value={completedTests.length} label="Completed Tests" detail="Released to doctors" />
        <InfoBox tone="danger" icon={<AlertTriangle size={22} />} value={criticalResults.length} label="Critical Abnormal Flags" detail="Urgent clinician alert" />
        <InfoBox tone="primary" icon={<Clock size={22} />} value={labOrders.filter(order => order.status === 'Analyzing').length} label="Tests In Analysis" detail="Live laboratory queue" />
      </div>

      {/* Main Laboratory Workbench Table */}
      <div className="card admin-card lab-workbench-card">
        <div className="card-header lab-workbench-header">
          <div className="lab-workbench-heading">
            <h3 className="card-title"><FlaskConical size={18} className="text-primary" /> Clinical Diagnostics Workbench &amp; Test Orders</h3>
            <p>Review requests, track specimen progress, and release verified results.</p>
          </div>

          <div className="lab-table-controls">
            <div className="search-bar lab-search-control">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search test, patient or ID…"
              />
            </div>
            <select className="lab-category-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="All">All categories</option>
              {categories.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
        </div>

        <div className="card-body p-0">
          <div className="table-wrapper lab-table-scroll">
            <table className="lab-orders-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Patient</th>
                  <th>Investigation &amp; Category</th>
                  <th>Specimen</th>
                  <th>Status &amp; Workflow</th>
                  <th>Result / Findings</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--clr-text-muted)' }}>
                      No laboratory orders match your current filters.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(order => (
                    <tr key={order.id}>
                      <td><code className="id-code">{order.id}</code></td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--clr-text-primary)' }}>{order.patientName}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--clr-text-muted)' }}>
                          MRN: {patientCodeFor(patients, order.patientId)} · Dr. {order.doctorName}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{order.testName}</div>
                        <span className="badge badge-blue" style={{ fontSize: '0.68rem', marginTop: 2 }}>
                          {order.category}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: 'var(--clr-text-secondary)' }}>
                          {order.specimenType}
                        </span>
                      </td>
                      <td>
                        <div className="lab-status-cell">
                          <span className={`badge ${
                          order.status === 'Completed' ? 'badge-green' :
                          order.status === 'Analyzing' ? 'badge-indigo' :
                          order.status === 'Sample Collected' ? 'badge-amber' :
                          'badge-gray'
                        }`}>
                          {order.status}
                          </span>
                          <div className="lab-status-track" aria-label={`${order.status} of ${workflowSteps.length} steps`}>
                            {workflowSteps.map((step, index) => {
                              const currentIndex = workflowSteps.indexOf(order.status);
                              return <span key={step} className={index <= currentIndex ? 'complete' : ''} />;
                            })}
                          </div>
                          <small>{order.status === 'Requested' ? 'Awaiting specimen' : order.status === 'Sample Collected' ? 'Specimen received' : order.status === 'Analyzing' ? 'Analysis underway' : 'Verified and released'}</small>
                        </div>
                      </td>
                      <td>
                        {order.status === 'Completed' ? (
                          <div>
                            <div style={{ fontWeight: 700, color: order.isAbnormal ? 'var(--clr-rose-400)' : 'var(--clr-emerald-400)', fontSize: '0.86rem' }}>
                              {order.result} {order.unit}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>
                              Ref: {order.referenceRange || 'Standard'}
                              {order.isAbnormal && <span className="badge badge-red ms-1" style={{ marginLeft: 4 }}>Abnormal</span>}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>
                            Awaiting analysis
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {order.status !== 'Completed' ? (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleAdvanceStatus(order)}
                              style={{ fontSize: '0.74rem', padding: '0.3rem 0.6rem' }}
                            >
                              {order.status === 'Requested' ? 'Collect Specimen' :
                               order.status === 'Sample Collected' ? 'Start Analysis' :
                               'Enter Real Result'}
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm btn-icon"
                                onClick={() => handlePrintReport(order)}
                                title="Print Official Lab Slip"
                              >
                                <Printer size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Real Clinical Laboratory Result Entry Modal */}
      {resultModal && (
        <ModalPortal>
        <div className="modal-overlay" onClick={() => setResultModal(null)} style={{ zIndex: 1100 }}>
          <div
            className="modal lab-result-modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="lab-result-heading">
              <div>
                <div className="lab-result-eyebrow">
                  Clinical Pathology &amp; Diagnostic Reporting
                </div>
                <h2>
                  <FlaskConical size={18} className="text-primary" /> {resultModal.testName}
                </h2>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setResultModal(null)} aria-label="Close dialog">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveResult} className="lab-result-form">
              {formError && <div className="alert alert-danger py-2 px-3 mb-3" role="alert">{formError}</div>}

              <div className="lab-result-meta">
                <div><strong>Patient</strong>{patientNameFor(patients, resultModal.patientId, resultModal.patientName)}</div>
                <div><strong>Card number</strong>{patientCodeFor(patients, resultModal.patientId)}</div>
                <div><strong>Ordering doctor</strong>Dr. {resultModal.doctorName}</div>
                <div><strong>Specimen</strong>{resultModal.specimenType} · {resultModal.category}</div>
              </div>

              <div className="lab-result-presets">
                <span className="lab-result-presets-label">Common result text</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleQuickResultFill('Negative / Normal', false)}>Negative / normal</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleQuickResultFill('Positive (+)', true)}>Positive</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleQuickResultFill('Normal Physiological Range', false)}>Normal range</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleQuickResultFill('Trace / Inconclusive (Repeat Recommended)', true)}>Trace / inconclusive</button>
              </div>

              {activeStandardTest?.parameters && activeStandardTest.parameters.length > 0 && (
                <section className="lab-parameter-list">
                  <h3><Sparkles size={14} /> Panel measurements</h3>
                  <div className="lab-parameter-row lab-parameter-heading" aria-hidden="true">
                    <span>Parameter</span><span>Result</span><span>Unit</span><span>Reference</span>
                  </div>
                  <div className="lab-parameter-rows">
                    {activeStandardTest.parameters.map(param => (
                      <div key={param.name} className="lab-parameter-row">
                        <span>{param.name}</span>
                        <input
                          placeholder="Measured value"
                          value={parameterValues[param.name] || ''}
                          onChange={e => handleParameterChange(param.name, e.target.value)}
                        />
                        <span className="lab-parameter-unit">{param.unit}</span>
                        <span className="lab-parameter-range">{param.refRange}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="lab-result-values">
                <div className="form-group lab-result-summary-field">
                  <label className="form-label">Summary result / clinical finding *</label>
                  <input
                    required
                    value={resultValue}
                    onChange={e => setResultValue(e.target.value)}
                    placeholder="Enter the final result or a concise clinical finding"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Measurement Unit</label>
                  <input
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    placeholder="e.g. mg/dL, g/dL, %, cells/HPF"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Normal Reference Range</label>
                  <input
                    value={referenceRange}
                    onChange={e => setReferenceRange(e.target.value)}
                    placeholder="e.g. 70 - 140 mg/dL, Negative"
                  />
                </div>
              </section>

              <div className={`lab-result-abnormal ${isAbnormal ? 'flagged' : ''}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={isAbnormal}
                    onChange={e => setIsAbnormal(e.target.checked)}
                  />
                  <AlertTriangle size={16} /> Flag as clinically abnormal / critical
                </label>
                {isAbnormal && <span className="badge badge-red">Abnormal flag</span>}
              </div>

              <div className="form-group lab-result-notes">
                <label className="form-label">Technologist remarks</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Observations or interpretation"
                />
              </div>

              <div className="lab-result-return-note">
                <CheckCircle2 size={16} /> Verified results return this visit to the OPD doctor for review.
              </div>

              <div className="modal-footer lab-result-actions">
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
        </ModalPortal>
      )}
    </div>
  );
}
