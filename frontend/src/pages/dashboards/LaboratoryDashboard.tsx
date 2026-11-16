import { useMemo, useState } from 'react';
import { useClinic } from '../../context/ClinicContext';
import { useAuth } from '../../context/AuthContext';
import InfoBox from '../../components/AdminLTE/InfoBox';
import type { LabOrder } from '../../types';
import { patientCodeFor, patientNameFor } from '../../utils/patient';
import {
  FlaskConical, CheckCircle2, Clock, AlertTriangle, X,
  Printer
} from 'lucide-react';
import './LaboratoryDashboard.css';
import ModalPortal from '../../components/ModalPortal';
import LoadingButton from '../../components/LoadingButton';
import { formatDateTime12, formatTime12 } from '../../utils/date';
import { cleanClinicalText, clinicalTextHtml } from '../../utils/clinicalText';

interface LabResultDraft {
  result: string;
  unit: string;
  referenceRange: string;
  isAbnormal: boolean;
  cost: string;
  loggedInAt: string;
  star: boolean;
  technicianInitials: string;
  technicianComment: string;
}

interface LabRequestGroup {
  id: string;
  orders: LabOrder[];
  first: LabOrder;
}

function patientAge(dateOfBirth?: string): string {
  if (!dateOfBirth) return '—';
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return '—';
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? `${age} years` : '—';
}

function nameInitials(name?: string): string {
  return (name || 'LT')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('');
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '—').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] || character);
}

export default function LaboratoryDashboard() {
  const { labOrders, patients, updateLabOrderGroup } = useClinic();
  const { currentUser } = useAuth();

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [resultModal, setResultModal] = useState<LabOrder[] | null>(null);

  const [resultDrafts, setResultDrafts] = useState<Record<string, LabResultDraft>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savingResult, setSavingResult] = useState(false);

  const pendingTests = labOrders.filter(o => o.status !== 'Completed');
  const completedTests = labOrders.filter(o => o.status === 'Completed');
  const criticalResults = labOrders.filter(o => o.isAbnormal);
  const categories = [...new Set(labOrders.map(order => order.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const requestGroups = useMemo<LabRequestGroup[]>(() => {
    const groups = new Map<string, LabOrder[]>();
    labOrders.forEach(order => {
      const id = order.requestGroupId || `single-${order.id}`;
      const group = groups.get(id) || [];
      group.push(order);
      groups.set(id, group);
    });
    return [...groups.entries()].map(([id, orders]) => {
      const sortedOrders = [...orders].sort((left, right) => left.orderedAt.localeCompare(right.orderedAt));
      return { id, orders: sortedOrders, first: sortedOrders[0] };
    }).sort((left, right) => right.first.orderedAt.localeCompare(left.first.orderedAt));
  }, [labOrders]);

  const filteredGroups = requestGroups.filter(group => {
    const matchCat = filterCategory === 'All' || group.orders.some(order => order.category === filterCategory);
    const matchStatus = statusFilter === 'All'
      || (statusFilter === 'Completed' && group.orders.every(order => order.status === 'Completed'))
      || (statusFilter === 'Requested' && group.orders.some(order => order.status !== 'Completed'));
    const matchPriority = priorityFilter === 'All' || group.orders.some(order => order.priority === priorityFilter);
    const searchValue = search.toLowerCase();
    const matchSearch = group.orders.some(order => order.patientName.toLowerCase().includes(searchValue)
      || order.testName.toLowerCase().includes(searchValue)
      || order.id.toLowerCase().includes(searchValue));
    return matchCat && matchStatus && matchPriority && matchSearch;
  });

  const resultPatient = resultModal?.[0] ? patients.find(patient => patient.id === resultModal[0].patientId) : undefined;

  const handleOpenResultEntry = (orders: LabOrder[]) => {
    const openedAt = new Date().toISOString();
    setResultModal(orders);
    setResultDrafts(Object.fromEntries(orders.map(order => [order.id, {
      result: order.result || '',
      unit: order.unit || '',
      referenceRange: order.referenceRange || '',
      isAbnormal: Boolean(order.isAbnormal),
      cost: order.cost === null || order.cost === undefined ? '' : String(order.cost),
      loggedInAt: order.loggedInAt || openedAt,
      star: Boolean(order.star || order.priority === 'Critical'),
      technicianInitials: order.technicianInitials || nameInitials(currentUser?.name),
      technicianComment: order.technicianComment || '',
    }])));
    setFormError(null);
  };

  const updateDraft = (orderId: string, changes: Partial<LabResultDraft>) => {
    setResultDrafts(previous => ({ ...previous, [orderId]: { ...previous[orderId], ...changes } }));
  };

  const handleSaveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resultModal) return;
    if (savingResult) return;
    const unfinished = resultModal.filter(order => order.status !== 'Completed' && !resultDrafts[order.id]?.result.trim());
    if (unfinished.length) {
      setFormError(`Enter a result for: ${unfinished.map(order => order.testName).join(', ')}.`);
      return;
    }

    const completedAt = new Date().toISOString();
    try {
      setSavingResult(true);
      const updates = resultModal.filter(order => order.status !== 'Completed').map(order => {
        const draft = resultDrafts[order.id];
        return {
          id: order.id,
          changes: {
            status: 'Completed' as const,
            result: draft.result.trim(),
            unit: draft.unit.trim(),
            referenceRange: draft.referenceRange.trim(),
            isAbnormal: draft.isAbnormal,
            completedAt,
            cost: draft.cost.trim() ? Number(draft.cost) : null,
            loggedInAt: draft.loggedInAt,
            loggedOutAt: completedAt,
            star: draft.star,
            technicianInitials: draft.technicianInitials.trim().toUpperCase(),
            technicianComment: draft.technicianComment.trim(),
            approvedBy: currentUser?.name || 'Laboratory technologist',
            approvedAt: completedAt,
          },
        };
      });
      await updateLabOrderGroup(updates);
      setFormError(null);
      setResultModal(null);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not save the laboratory result.');
    } finally {
      setSavingResult(false);
    }
  };

  const handlePrintReport = (order: LabOrder) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const patient = patients.find(item => item.id === order.patientId);
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lab Report - ${escapeHtml(order.patientName)}</title>
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
          <div><strong>Patient:</strong> ${escapeHtml(order.patientName)}</div>
          <div><strong>Order ID:</strong> ${escapeHtml(order.id)}</div>
          <div><strong>Requesting Clinician:</strong> ${escapeHtml(order.doctorName)}</div>
          <div><strong>Specimen:</strong> ${escapeHtml(order.specimenType)} (${escapeHtml(order.category)})</div>
          <div><strong>Sex:</strong> ${escapeHtml(patient?.gender)}</div>
          <div><strong>Address:</strong> ${escapeHtml(patient?.address)}</div>
          <div><strong>Ordered:</strong> ${escapeHtml(formatDateTime12(order.orderedAt))}</div>
          <div><strong>Verified:</strong> ${escapeHtml(order.completedAt ? formatTime12(order.completedAt) : 'Completed today')}</div>
          <div><strong>Cost:</strong> ${escapeHtml(order.cost)}</div>
          <div><strong>STAR / STAT:</strong> ${order.star ? 'Yes' : 'No'}</div>
          <div><strong>Tech initials:</strong> ${escapeHtml(order.technicianInitials)}</div>
        </div>
        <div class="result-box">
          <div class="result-title">Investigation: ${escapeHtml(order.testName)}</div>
          <div class="result-val ${order.isAbnormal ? 'abnormal' : ''}">
            Measured Result: ${escapeHtml(order.result)} ${escapeHtml(order.unit || '')}
            ${order.isAbnormal ? ' [CRITICAL / ABNORMAL FLAG]' : ' [NORMAL]'}
          </div>
          <div style="font-size: 13px; margin-top: 6px; color: #475569;">
            Reference Range: ${escapeHtml(order.referenceRange || 'Standard normal')}
          </div>
          ${order.notes ? `<div style="font-size: 13px; margin-top: 10px; font-style: italic;">Remarks: ${clinicalTextHtml(order.notes)}</div>` : ''}
          ${order.technicianComment ? `<div style="font-size: 13px; margin-top: 10px;">Tech's comment: ${clinicalTextHtml(order.technicianComment)}</div>` : ''}
          ${order.approvedBy ? `<div style="font-size: 13px; margin-top: 10px;">Approved by: ${escapeHtml(order.approvedBy)} · ${order.approvedAt ? escapeHtml(formatDateTime12(order.approvedAt)) : ''}</div>` : ''}
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
          <span><strong>{pendingTests.length}</strong> requested tests</span>
        </div>
        <span className="lab-queue-summary-copy">Read the clinician request first, then enter and verify the result.</span>
      </div>

      {/* Laboratory KPIs */}
      <div className="lab-kpi-grid">
        <InfoBox
          tone="info"
          icon={<FlaskConical size={22} />}
          value={pendingTests.length}
          label="Pending Lab Requests"
          detail="From OPD and Emergency"
          onClick={() => { setStatusFilter('Requested'); setPriorityFilter('All'); }}
          footerText="Filter pending"
        />
        <InfoBox
          tone="success"
          icon={<CheckCircle2 size={22} />}
          value={completedTests.length}
          label="Completed Tests"
          detail="Released to doctors"
          onClick={() => { setStatusFilter('Completed'); setPriorityFilter('All'); }}
          footerText="Filter completed"
        />
        <InfoBox
          tone="danger"
          icon={<AlertTriangle size={22} />}
          value={criticalResults.length}
          label="Critical Abnormal Flags"
          detail="Urgent clinician alert"
          onClick={() => { setPriorityFilter('Critical'); setStatusFilter('All'); }}
          footerText="Filter critical"
        />
        <InfoBox
          tone="primary"
          icon={<Clock size={22} />}
          value={pendingTests.length}
          label="Awaiting Results"
          detail="Ready for result entry"
          onClick={() => { setStatusFilter('Requested'); setPriorityFilter('All'); }}
          footerText="Filter requested"
        />
      </div>

      {/* Main Laboratory Workbench Table */}
      <div className="card admin-card lab-workbench-card">
        <div className="card-header lab-workbench-header">
          <div className="lab-workbench-heading">
            <h3 className="card-title"><FlaskConical size={18} className="text-primary" /> Clinical Diagnostics Workbench &amp; Test Orders</h3>
            <p>Review the requested investigation and clinician instructions, then record the verified result.</p>
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
                  <th>Request status</th>
                  <th>Result / Findings</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.length === 0 ? (
                  <tr className="empty-state-row">
                    <td colSpan={7}>
                      <div className="empty-state">
                        <div className="empty-state-icon tone-blue"><FlaskConical size={28} /></div>
                        <h5 className="empty-state-title">No laboratory orders found</h5>
                        <p className="empty-state-body">
                          No diagnostic orders match the current filters. Orders will appear here automatically when OPD doctors request laboratory investigations.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredGroups.map(group => {
                    const { first, orders } = group;
                    const completed = orders.filter(order => order.status === 'Completed');
                    const pending = orders.length - completed.length;
                    return (
                    <tr key={group.id}>
                      <td><code className="id-code">{first.requestGroupId || first.id}</code></td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--clr-text-primary)' }}>{first.patientName}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--clr-text-muted)' }}>
                          MRN: {patientCodeFor(patients, first.patientId)} · Dr. {first.doctorName}
                        </div>
                      </td>
                      <td>
                        <div className="lab-group-test-list">{orders.map(order => <span key={order.id}><strong>{order.testName}</strong><small>{order.category}</small></span>)}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: 'var(--clr-text-secondary)' }}>{[...new Set(orders.map(order => order.specimenType))].join(', ')}</span>
                        <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)', marginTop: 4 }}>
                          {orders.length} requested test{orders.length === 1 ? '' : 's'}
                        </div>
                      </td>
                      <td>
                        <div className="lab-status-cell">
                          <span className={`badge ${pending === 0 ? 'badge-green' : 'badge-gray'}`}>
                            {pending === 0 ? 'Results released' : `${completed.length}/${orders.length} complete`}
                          </span>
                          {orders.some(order => order.star) && <span className="badge badge-red" style={{ marginLeft: 4 }}>STAT</span>}
                          <small>{pending === 0 ? 'Verified and released to OPD' : 'Awaiting laboratory result'}</small>
                        </div>
                      </td>
                      <td>
                        {completed.length ? (
                          <div className="lab-group-result-list">{completed.map(order => <div key={order.id}><strong className={order.isAbnormal ? 'is-abnormal' : ''}>{order.testName}: {order.result} {order.unit}</strong><small>{order.referenceRange ? `Ref: ${order.referenceRange}` : 'Reference not entered'}{order.isAbnormal ? ' · Abnormal' : ''}</small></div>)}</div>
                        ) : (
                          <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>
                            Awaiting analysis
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {pending > 0 ? (
                            <LoadingButton
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleOpenResultEntry(orders)}
                              loading={false}
                              loadingLabel="Opening…"
                              style={{ fontSize: '0.74rem', padding: '0.3rem 0.6rem' }}
                            >
                              Open request
                            </LoadingButton>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm btn-icon"
                                onClick={() => handlePrintReport(orders[0])}
                                title="Print Laboratory Result"
                              >
                                <Printer size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Real Clinical Laboratory Result Entry Modal */}
      {resultModal && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => !savingResult && setResultModal(null)} style={{ zIndex: 1100 }}>
            <div className="modal lab-result-modal lab-result-paper-modal" onClick={event => event.stopPropagation()}>
              <div className="lab-result-heading">
                <div>
                  <div className="lab-result-eyebrow">General laboratory request and report</div>
                  <h2><FlaskConical size={18} className="text-primary" /> Enter results for {resultModal.length} requested test{resultModal.length === 1 ? '' : 's'}</h2>
                </div>
                <button type="button" className="modal-close-btn" onClick={() => setResultModal(null)} disabled={savingResult} aria-label="Close dialog"><X size={16} /></button>
              </div>

              <form onSubmit={handleSaveResult} noValidate className="lab-result-form">
                {formError && <div className="alert alert-danger py-2 px-3 mb-3" role="alert">{formError}</div>}
                <div className="lab-result-paper-sheet">
                  <header className="lab-result-paper-header">
                    <img src="/bu-logo.png" alt="Borana University emblem" />
                    <div><strong>BORANA UNIVERSITY</strong><span>Student Service Clinic</span><b>GENERAL LABORATORY REQUEST<br />AND REPORT FORM</b></div>
                    <div className="lab-result-paper-meta"><span>Request: <b>{resultModal[0].requestGroupId || resultModal[0].id}</b></span><span>Order date: <b>{new Date(resultModal[0].orderedAt).toLocaleDateString()}</b></span><span>Form: <b>Page 1 of 2</b></span></div>
                  </header>

                  <section className="lab-result-paper-patient">
                    <div><b>Patient name</b><span>{patientNameFor(patients, resultModal[0].patientId, resultModal[0].patientName)}</span></div>
                    <div><b>Age / Sex</b><span>{patientAge(resultPatient?.dateOfBirth)} · {resultPatient?.gender || '—'}</span></div>
                    <div><b>MRN</b><span>{patientCodeFor(patients, resultModal[0].patientId)}</span></div>
                    <div><b>Address</b><span>{resultPatient?.address || '—'}</span></div>
                    <div><b>Referring clinician</b><span>Dr. {resultModal[0].doctorName}</span></div>
                    <div><b>Priority / STAR</b><span>{resultModal.some(order => order.star || order.priority === 'Critical') ? 'STAT / Emergency' : resultModal[0].priority}</span></div>
                    <div className="lab-result-paper-request-note"><b>Clinical notes / instructions from OPD</b><span>{cleanClinicalText(resultModal[0].notes) || 'No additional instructions provided.'}</span></div>
                  </section>

                  <div className="lab-result-paper-section-title">Requested investigations and laboratory report</div>
                  <div className="lab-result-entry-list">
                    {resultModal.map((order, index) => {
                      const draft = resultDrafts[order.id];
                      const readonly = order.status === 'Completed';
                      if (!draft) return null;
                      return (
                        <article className={`lab-result-entry${draft.isAbnormal ? ' is-abnormal' : ''}${readonly ? ' is-complete' : ''}`} key={order.id}>
                          <header><span className="lab-result-entry-number">{index + 1}</span><div><strong>{order.testName}</strong><small>{order.category} · {order.specimenType}</small></div><span className={`badge ${readonly ? 'badge-green' : 'badge-blue'}`}>{readonly ? 'Verified' : 'Requested'}</span></header>
                          {order.notes && <p className="lab-result-request-instructions"><b>OPD request:</b> {cleanClinicalText(order.notes)}</p>}
                          <div className="lab-result-entry-fields">
                            <label className="lab-result-entry-value"><span>Result / clinical finding {readonly ? '' : '*'}</span><textarea rows={2} required={!readonly} readOnly={readonly} value={draft.result} onChange={event => updateDraft(order.id, { result: event.target.value })} placeholder="Enter result for this requested test" /></label>
                            <label><span>Unit</span><input readOnly={readonly} value={draft.unit} onChange={event => updateDraft(order.id, { unit: event.target.value })} placeholder="e.g. mg/dL" /></label>
                            <label><span>Reference range</span><input readOnly={readonly} value={draft.referenceRange} onChange={event => updateDraft(order.id, { referenceRange: event.target.value })} placeholder="Expected range" /></label>
                            <label><span>Cost (lab use)</span><input readOnly={readonly} type="number" min="0" step="0.01" value={draft.cost} onChange={event => updateDraft(order.id, { cost: event.target.value })} placeholder="—" /></label>
                            <label><span>Technologist initials</span><input readOnly={readonly} maxLength={10} value={draft.technicianInitials} onChange={event => updateDraft(order.id, { technicianInitials: event.target.value })} placeholder="Initials" /></label>
                            <label className="lab-result-entry-abnormal"><input type="checkbox" disabled={readonly} checked={draft.isAbnormal} onChange={event => updateDraft(order.id, { isAbnormal: event.target.checked })} /><AlertTriangle size={14} /> Flag abnormal</label>
                            <label className="lab-result-entry-comment"><span>Tech’s comment</span><textarea rows={2} readOnly={readonly} value={draft.technicianComment} onChange={event => updateDraft(order.id, { technicianComment: event.target.value })} placeholder="Observation or interpretation" /></label>
                            <div className="lab-result-entry-log"><span>Log in: {formatDateTime12(draft.loggedInAt)}</span><span>Log out: {readonly && order.loggedOutAt ? formatDateTime12(order.loggedOutAt) : 'Set on verification'}</span></div>
                          </div>
                          {readonly && order.approvedBy && <div className="lab-result-entry-approval"><CheckCircle2 size={14} /> Verified by {order.approvedBy}{order.approvedAt ? ` · ${formatDateTime12(order.approvedAt)}` : ''}</div>}
                        </article>
                      );
                    })}
                  </div>

                  <footer className="lab-result-paper-signoff"><div><b>Approved by</b><span>{currentUser?.name || 'Laboratory technologist'}</span><small>Technologist signature / date</small></div><div><b>Requesting clinician</b><span>Dr. {resultModal[0].doctorName}</span><small>Digital request from OPD</small></div></footer>
                </div>

                <div className="modal-footer lab-result-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setResultModal(null)} disabled={savingResult}>Cancel</button>
                  {resultModal.some(order => order.status !== 'Completed') && <LoadingButton type="submit" className="btn btn-primary" loading={savingResult} loadingLabel="Verifying results…"><CheckCircle2 size={16} /> Verify and return all results to OPD</LoadingButton>}
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
