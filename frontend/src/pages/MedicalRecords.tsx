import React, { useState } from 'react';
import { useClinic } from '../context/ClinicContext';
import type { MedicalRecord } from '../types';
import {
  Plus, Search, X, Eye, FileText, FilePlus, Pill, FlaskConical,
  Calendar, Clock, Stethoscope, Activity, User, CheckCircle2,
  HeartPulse
} from 'lucide-react';

const AVATAR_GRADIENTS = [
  'avatar-grad-blue',
  'avatar-grad-purple',
  'avatar-grad-green',
  'avatar-grad-amber',
  'avatar-grad-indigo',
  'avatar-grad-teal',
  'avatar-grad-rose',
];

function getAvatarClass(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function getInitials(name: string) {
  const parts = name.replace(/^Dr\.\s*/i, '').trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0] ? parts[0].slice(0, 2) : 'PT').toUpperCase();
}

export default function MedicalRecords() {
  const { records, patients, doctors, addRecord } = useClinic();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'rx' | 'lab' | 'followup'>('all');
  const [modal, setModal] = useState<{ mode: 'view' | 'add' | null; record?: MedicalRecord }>({ mode: null });
  const [form, setForm] = useState({
    patientId: '', doctorId: '', visitDate: new Date().toISOString().split('T')[0], diagnosis: '',
    symptoms: '', notes: '', followUpDate: '', medications: '',
  });

  // Filter records based on search and active quick filter
  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    const matchesSearch = `${r.patientName} ${r.doctorName} ${r.diagnosis} ${r.id} ${r.symptoms.join(' ')}`.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (activeFilter === 'rx') return r.prescription && r.prescription.length > 0;
    if (activeFilter === 'lab') return r.labTests && r.labTests.length > 0;
    if (activeFilter === 'followup') return Boolean(r.followUpDate);
    return true;
  });

  // KPI Calculations
  const totalPrescriptions = records.reduce((acc, r) => acc + (r.prescription?.length || 0), 0);
  const totalLabTests = records.reduce((acc, r) => acc + (r.labTests?.length || 0), 0);
  const totalFollowUps = records.filter(r => Boolean(r.followUpDate)).length;

  const openAdd = () => {
    setForm({
      patientId: patients[0]?.id || '',
      doctorId: doctors[0]?.id || '',
      visitDate: new Date().toISOString().split('T')[0],
      diagnosis: '',
      symptoms: '',
      notes: '',
      followUpDate: '',
      medications: '',
    });
    setModal({ mode: 'add' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = patients.find(x => x.id === form.patientId);
    const d = doctors.find(x => x.id === form.doctorId);
    if (!p || !d) return;
    addRecord({
      patientId: p.id,
      patientName: `${p.firstName} ${p.lastName}`,
      doctorId: d.id,
      doctorName: `${d.firstName} ${d.lastName}`,
      visitDate: form.visitDate,
      diagnosis: form.diagnosis,
      symptoms: form.symptoms.split(',').map(s => s.trim()).filter(Boolean),
      prescription: form.medications.split('\n').filter(Boolean).map(m => ({
        medication: m, dosage: 'As directed', frequency: 'Standard regimen', duration: '7 days',
      })),
      notes: form.notes,
      followUpDate: form.followUpDate || undefined,
    });
    setModal({ mode: null });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* ── Top Header Banner with Borana University Branding ── */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(14, 27, 54, 0.95) 0%, rgba(20, 39, 78, 0.88) 50%, rgba(13, 24, 48, 0.95) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.28)',
        borderRadius: 16,
        padding: '1.75rem 2rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Ambient background glow */}
        <div style={{
          position: 'absolute', top: -30, right: -20, width: 260, height: 260,
          background: 'radial-gradient(circle, rgba(37, 99, 235, 0.18) 0%, transparent 70%)',
          pointerEvents: 'none', filter: 'blur(35px)'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '0.3rem 0.75rem', borderRadius: 99,
              background: 'rgba(37, 99, 235, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#60a5fa', fontSize: '0.74rem', fontWeight: 700,
              letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '0.65rem'
            }}>
              <HeartPulse size={14} /> Borana University Health Services EHR
            </div>
            <h1 style={{
              fontSize: '1.85rem', fontWeight: 900, fontFamily: 'var(--font-heading)',
              color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '0.35rem'
            }}>
              Medical Records &amp; Clinical Encounters
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>Centralized Patient Health Archive</span>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
              <span>Active Diagnostic Histories, Prescriptions &amp; Lab Results</span>
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '0.45rem 0.95rem', borderRadius: 99,
              background: 'rgba(14, 165, 233, 0.15)', border: '1px solid rgba(14, 165, 233, 0.35)',
              color: '#38bdf8', fontSize: '0.8rem', fontWeight: 700
            }}>
              <FileText size={14} /> {records.length} Archived Records
            </div>
            <button className="btn btn-primary" id="add-record-btn" onClick={openAdd} style={{ padding: '0.7rem 1.4rem' }}>
              <Plus size={17} /> New Medical Record
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Metric Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.1rem' }}>
        
        {/* Card 1: Total Records */}
        <div className="stat-card" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <FileText size={24} />
          </div>
          <div>
            <div className="stat-value">{records.length}</div>
            <div className="stat-label">Total Patient Records</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)', marginTop: '0.2rem' }}>All-time documented visits</div>
          </div>
        </div>

        {/* Card 2: Prescriptions */}
        <div className="stat-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Pill size={24} />
          </div>
          <div>
            <div className="stat-value">{totalPrescriptions}</div>
            <div className="stat-label">Prescriptions Issued</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)', marginTop: '0.2rem' }}>Integrated with Pharmacy</div>
          </div>
        </div>

        {/* Card 3: Lab Tests */}
        <div className="stat-card" style={{ borderColor: 'rgba(139, 92, 246, 0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
            <FlaskConical size={24} />
          </div>
          <div>
            <div className="stat-value">{totalLabTests}</div>
            <div className="stat-label">Laboratory Orders</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)', marginTop: '0.2rem' }}>Diagnostic tests ordered</div>
          </div>
        </div>

        {/* Card 4: Follow-Ups */}
        <div className="stat-card" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
          <div>
            <div className="stat-value">{totalFollowUps}</div>
            <div className="stat-label">Follow-Up Reviews</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)', marginTop: '0.2rem' }}>Scheduled re-examinations</div>
          </div>
        </div>
      </div>

      {/* ── Filters & Search Bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        
        {/* Search Input */}
        <div className="search-bar" style={{ maxWidth: 420 }}>
          <Search size={16} className="icon" />
          <input
            id="record-search"
            placeholder="Search records by patient, doctor, diagnosis, symptoms…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                color: 'var(--clr-text-muted)', cursor: 'pointer',
              }}
              title="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="pill-tabs">
          <button
            className={`pill-tab ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All Encounters ({records.length})
          </button>
          <button
            className={`pill-tab ${activeFilter === 'rx' ? 'active' : ''}`}
            onClick={() => setActiveFilter('rx')}
          >
            <Pill size={13} style={{ display: 'inline', marginRight: 4 }} />
            Prescriptions ({records.filter(r => (r.prescription?.length || 0) > 0).length})
          </button>
          <button
            className={`pill-tab ${activeFilter === 'lab' ? 'active' : ''}`}
            onClick={() => setActiveFilter('lab')}
          >
            <FlaskConical size={13} style={{ display: 'inline', marginRight: 4 }} />
            Lab Tests ({records.filter(r => (r.labTests?.length || 0) > 0).length})
          </button>
          <button
            className={`pill-tab ${activeFilter === 'followup' ? 'active' : ''}`}
            onClick={() => setActiveFilter('followup')}
          >
            <Clock size={13} style={{ display: 'inline', marginRight: 4 }} />
            Follow-Up ({totalFollowUps})
          </button>
        </div>
      </div>

      {/* ── Table Container ── */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Patient &amp; ID</th>
              <th style={{ width: '28%' }}>Diagnosis &amp; Symptoms</th>
              <th style={{ width: '18%' }}>Attending Doctor</th>
              <th style={{ width: '12%' }}>Visit Date</th>
              <th style={{ width: '12%' }}>Follow-Up</th>
              <th style={{ width: '8%' }}>Rx / Lab</th>
              <th style={{ width: '8%', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--clr-text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%',
                      background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--clr-primary-300)'
                    }}>
                      <Search size={24} />
                    </div>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>No medical records match your criteria</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)' }}>Try adjusting your search terms or filter tabs</span>
                  </div>
                </td>
              </tr>
            ) : filtered.map(r => {
              const matchedPatient = patients.find(p => p.id === r.patientId);
              const avatarCls = getAvatarClass(r.patientId || r.patientName);
              const initials = getInitials(r.patientName);

              return (
                <tr key={r.id}>
                  {/* Patient Info */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className={`avatar ${avatarCls}`} style={{ width: 38, height: 38, fontSize: '0.8rem', fontWeight: 800 }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--clr-text-primary)', fontSize: '0.92rem' }}>
                          {r.patientName}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                          <span className="id-code" style={{ fontSize: '0.7rem' }}>{r.patientId}</span>
                          {matchedPatient && (
                            <span className={`badge ${matchedPatient.patientType === 'Student' ? 'badge-cyan' : 'badge-teal'}`} style={{ fontSize: '0.65rem', padding: '0.08rem 0.45rem' }}>
                              {matchedPatient.patientType}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Diagnosis & Symptoms */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                      <Activity size={14} style={{ color: '#38bdf8', flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--clr-text-primary)' }}>
                        {r.diagnosis}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {r.symptoms.slice(0, 3).map((s, idx) => (
                        <span key={s} className={`badge ${idx % 2 === 0 ? 'badge-violet' : 'badge-blue'}`} style={{ fontSize: '0.68rem', padding: '0.1rem 0.5rem' }}>
                          {s}
                        </span>
                      ))}
                      {r.symptoms.length > 3 && (
                        <span className="badge badge-indigo" style={{ fontSize: '0.65rem' }}>
                          +{r.symptoms.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Attending Doctor */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.15)',
                        border: '1px solid rgba(59, 130, 246, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#60a5fa', flexShrink: 0
                      }}>
                        <Stethoscope size={14} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.doctorName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>OPD Physician</div>
                      </div>
                    </div>
                  </td>

                  {/* Visit Date */}
                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--clr-text-secondary)', fontSize: '0.84rem' }}>
                      <Calendar size={13} style={{ color: 'var(--clr-primary-300)' }} />
                      <span>{r.visitDate}</span>
                    </div>
                  </td>

                  {/* Follow-Up Date */}
                  <td>
                    {r.followUpDate ? (
                      <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0.2rem 0.55rem', fontWeight: 700 }}>
                        <Clock size={12} /> {r.followUpDate}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.78rem' }}>None scheduled</span>
                    )}
                  </td>

                  {/* Prescriptions & Lab badges */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
                      {r.prescription && r.prescription.length > 0 ? (
                        <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Pill size={11} /> {r.prescription.length} meds
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>No meds</span>
                      )}

                      {r.labTests && r.labTests.length > 0 && (
                        <span className="badge badge-violet" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <FlaskConical size={11} /> {r.labTests.length} tests
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Action */}
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setModal({ mode: 'view', record: r })}
                      style={{
                        padding: '0.38rem 0.75rem',
                        fontSize: '0.78rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                      title="View Complete Clinical Record"
                    >
                      <Eye size={14} /> View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Modals ── */}
      {modal.mode && (
        <div className="modal-overlay" onClick={() => setModal({ mode: null })}>
          <div
            className="modal modal-lg"
            onClick={e => e.stopPropagation()}
            style={{
              maxHeight: '92vh',
              background: 'linear-gradient(145deg, #091325 0%, #0d1c38 100%)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(37, 99, 235, 0.25)',
              padding: '1.75rem',
            }}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              paddingBottom: '1.1rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(59, 130, 246, 0.22)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10,
                  background: modal.mode === 'add'
                    ? 'linear-gradient(135deg, #2563eb, #06b6d4)'
                    : 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
                }}>
                  {modal.mode === 'add' ? <FilePlus size={20} /> : <FileText size={20} />}
                </div>
                <div>
                  <h2 className="modal-title" style={{ fontSize: '1.25rem' }}>
                    {modal.mode === 'add' ? 'Create New Medical Record' : 'Medical Record Encounter Details'}
                  </h2>
                  <div style={{ fontSize: '0.76rem', color: 'var(--clr-text-muted)' }}>
                    Borana University Health Services Clinic • Electronic Health Records
                  </div>
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm btn-icon"
                onClick={() => setModal({ mode: null })}
                style={{ borderRadius: '50%', width: 32, height: 32 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            {modal.mode === 'view' && modal.record ? (
              <RecordView record={modal.record} onClose={() => setModal({ mode: null })} />
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  
                  {/* Section 1: Patient & Doctor */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(14, 28, 56, 0.95) 0%, rgba(18, 38, 75, 0.88) 100%)',
                    border: '1px solid rgba(59, 130, 246, 0.28)',
                    borderRadius: 12, padding: '1.25rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.85rem', color: '#60a5fa', fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <User size={15} /> 1. Patient &amp; Doctor Information
                    </div>
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#cbd5e1' }}>Patient *</label>
                        <select required value={form.patientId} onChange={e => setForm(f => ({ ...f, patientId: e.target.value }))} style={{ background: 'rgba(10, 18, 36, 0.9)', color: '#ffffff' }}>
                          <option value="">Select patient…</option>
                          {patients.map(p => (
                            <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.id} - {p.patientType})</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#cbd5e1' }}>Attending Doctor *</label>
                        <select required value={form.doctorId} onChange={e => setForm(f => ({ ...f, doctorId: e.target.value }))} style={{ background: 'rgba(10, 18, 36, 0.9)', color: '#ffffff' }}>
                          <option value="">Select doctor…</option>
                          {doctors.map(d => (
                            <option key={d.id} value={d.id}>{d.firstName} {d.lastName} ({d.specialization})</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#cbd5e1' }}>Visit Date *</label>
                        <input required type="date" value={form.visitDate} onChange={e => setForm(f => ({ ...f, visitDate: e.target.value }))} style={{ background: 'rgba(10, 18, 36, 0.9)', color: '#ffffff' }} />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#cbd5e1' }}>Follow-Up Date</label>
                        <input type="date" value={form.followUpDate} onChange={e => setForm(f => ({ ...f, followUpDate: e.target.value }))} style={{ background: 'rgba(10, 18, 36, 0.9)', color: '#ffffff' }} />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Clinical Evaluation & Diagnosis */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(28, 16, 52, 0.95) 0%, rgba(38, 22, 70, 0.88) 100%)',
                    border: '1px solid rgba(139, 92, 246, 0.28)',
                    borderRadius: 12, padding: '1.25rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.85rem', color: '#c4b5fd', fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <Activity size={15} /> 2. Clinical Findings &amp; Primary Diagnosis
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#cbd5e1' }}>Primary Diagnosis *</label>
                        <input required value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} placeholder="e.g. Acute Upper Respiratory Tract Infection" style={{ background: 'rgba(16, 10, 32, 0.9)', color: '#ffffff' }} />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#cbd5e1' }}>Symptoms &amp; Clinical Signs (comma-separated)</label>
                        <input value={form.symptoms} onChange={e => setForm(f => ({ ...f, symptoms: e.target.value }))} placeholder="e.g. High fever, Cough, Sore throat, Fatigue" style={{ background: 'rgba(16, 10, 32, 0.9)', color: '#ffffff' }} />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Medication & Prescription */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(10, 34, 40, 0.95) 0%, rgba(14, 46, 52, 0.88) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.28)',
                    borderRadius: 12, padding: '1.25rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.85rem', color: '#34d399', fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <Pill size={15} /> 3. Prescription (one drug per line)
                    </div>
                    <div className="form-group">
                      <textarea
                        rows={3}
                        value={form.medications}
                        onChange={e => setForm(f => ({ ...f, medications: e.target.value }))}
                        placeholder="Amoxicillin 500mg (3x daily, 7 days)&#10;Paracetamol 500mg (TDS PRN, 5 days)"
                        style={{ resize: 'vertical', background: 'rgba(8, 24, 28, 0.9)', color: '#ffffff' }}
                      />
                    </div>
                  </div>

                  {/* Section 4: Notes */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(38, 26, 12, 0.95) 0%, rgba(52, 34, 16, 0.88) 100%)',
                    border: '1px solid rgba(245, 158, 11, 0.28)',
                    borderRadius: 12, padding: '1.25rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.85rem', color: '#fbbf24', fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <FileText size={15} /> 4. Clinical Notes &amp; Patient Advice
                    </div>
                    <div className="form-group">
                      <textarea
                        rows={3}
                        value={form.notes}
                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Advised hydration, bed rest for 48 hours, avoid irritants. Return immediately if high fever recurs."
                        style={{ resize: 'vertical', background: 'rgba(24, 16, 8, 0.9)', color: '#ffffff' }}
                      />
                    </div>
                  </div>

                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--clr-border)' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setModal({ mode: null })}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.65rem 1.5rem' }}>
                    <Plus size={16} /> Save Record
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Record View Component with Rich Color Aesthetics ──
function RecordView({ record: r, onClose }: { record: MedicalRecord; onClose: () => void }) {
  const { patients } = useClinic();
  const matchedPatient = patients.find(p => p.id === r.patientId);
  const avatarCls = getAvatarClass(r.patientId || r.patientName);
  const initials = getInitials(r.patientName);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* ── Top Hero Profile Card ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(14, 27, 54, 0.95) 0%, rgba(20, 39, 78, 0.88) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.28)',
        borderRadius: 14,
        padding: '1.25rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className={`avatar ${avatarCls}`} style={{ width: 56, height: 56, fontSize: '1.2rem', fontWeight: 800, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
            {initials}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff' }}>
                {r.patientName}
              </h3>
              <span className="id-code" style={{ fontSize: '0.75rem' }}>{r.patientId}</span>
              {matchedPatient && (
                <span className={`badge ${matchedPatient.patientType === 'Student' ? 'badge-cyan' : 'badge-teal'}`}>
                  {matchedPatient.patientType}
                </span>
              )}
              {matchedPatient?.bloodGroup && (
                <span className="badge badge-red" style={{ fontWeight: 800 }}>
                  Blood: {matchedPatient.bloodGroup}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              {matchedPatient?.department && <span>Department of {matchedPatient.department} • </span>}
              {matchedPatient?.phone && <span>{matchedPatient.phone}</span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 8, padding: '0.45rem 0.85rem',
            textAlign: 'right',
          }}>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Record ID</div>
            <div style={{ fontWeight: 800, color: '#60a5fa', fontFamily: 'monospace' }}>{r.id}</div>
          </div>
          <div style={{
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 8, padding: '0.45rem 0.85rem',
            textAlign: 'right',
          }}>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Visit Date</div>
            <div style={{ fontWeight: 800, color: '#ffffff' }}>{r.visitDate}</div>
          </div>
        </div>
      </div>

      {/* ── Key Encounter Details Bar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
        
        <div className="card" style={{ padding: '0.9rem 1.1rem', background: 'linear-gradient(135deg, rgba(14, 28, 56, 0.9) 0%, rgba(18, 38, 75, 0.8) 100%)', borderColor: 'rgba(59, 130, 246, 0.28)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#60a5fa', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
            <Stethoscope size={14} /> Attending Doctor
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>{r.doctorName}</div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Staff Physician</div>
        </div>

        <div className="card" style={{ padding: '0.9rem 1.1rem', background: 'linear-gradient(135deg, rgba(10, 34, 40, 0.9) 0%, rgba(14, 46, 52, 0.8) 100%)', borderColor: 'rgba(16, 185, 129, 0.28)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#34d399', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
            <Calendar size={14} /> Encounter Status
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#34d399' }}>
            Completed &amp; Signed
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>On-Campus Clinic</div>
        </div>

        <div className="card" style={{ padding: '0.9rem 1.1rem', background: r.followUpDate ? 'linear-gradient(135deg, rgba(38, 26, 12, 0.9) 0%, rgba(52, 34, 16, 0.8) 100%)' : 'rgba(15, 27, 52, 0.5)', borderColor: r.followUpDate ? 'rgba(245, 158, 11, 0.35)' : 'rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: r.followUpDate ? '#fbbf24' : '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
            <Clock size={14} /> Follow-Up Consultation
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: r.followUpDate ? '#fbbf24' : '#94a3b8' }}>
            {r.followUpDate ? r.followUpDate : 'No follow-up set'}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            {r.followUpDate ? 'Action required by patient' : 'Routine discharge'}
          </div>
        </div>
      </div>

      {/* ── Diagnosis & Symptoms Card ── */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(10, 30, 56, 0.95) 0%, rgba(14, 42, 75, 0.88) 100%)',
        borderColor: 'rgba(6, 182, 212, 0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(6, 182, 212, 0.2)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={16} />
          </div>
          <h4 style={{ color: '#38bdf8', fontSize: '0.88rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Primary Clinical Diagnosis
          </h4>
        </div>
        <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.75rem' }}>
          {r.diagnosis}
        </p>

        {r.symptoms && r.symptoms.length > 0 && (
          <div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Identified Symptoms &amp; Clinical Presentation
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {r.symptoms.map(s => (
                <span key={s} className="badge badge-violet" style={{ padding: '0.25rem 0.75rem', fontSize: '0.78rem' }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Prescription Section (Rich Emerald Cards) ── */}
      {r.prescription && r.prescription.length > 0 && (
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(10, 34, 40, 0.95) 0%, rgba(14, 46, 52, 0.88) 100%)',
          borderColor: 'rgba(16, 185, 129, 0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Pill size={16} />
              </div>
              <h4 style={{ color: '#34d399', fontSize: '0.88rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Prescription &amp; Pharmacotherapy ({r.prescription.length} Items)
              </h4>
            </div>
            <span className="badge badge-green">Dispensed by Pharmacy</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {r.prescription.map((rx, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(16, 185, 129, 0.22)',
                  borderRadius: 10,
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#ffffff' }}>
                      {rx.medication}
                    </div>
                    {rx.instructions && (
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                        {rx.instructions}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {rx.dosage && (
                    <span className="badge badge-cyan" style={{ fontSize: '0.72rem' }}>
                      Dosage: {rx.dosage}
                    </span>
                  )}
                  {rx.frequency && (
                    <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>
                      {rx.frequency}
                    </span>
                  )}
                  {rx.duration && (
                    <span className="badge badge-amber" style={{ fontSize: '0.72rem' }}>
                      {rx.duration}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Lab Tests Section (Rich Violet Cards) ── */}
      {r.labTests && r.labTests.length > 0 && (
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(28, 16, 52, 0.95) 0%, rgba(38, 22, 70, 0.88) 100%)',
          borderColor: 'rgba(139, 92, 246, 0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FlaskConical size={16} />
              </div>
              <h4 style={{ color: '#c4b5fd', fontSize: '0.88rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Diagnostic Laboratory Findings ({r.labTests.length} Tests)
              </h4>
            </div>
            <span className="badge badge-violet">Clinical Pathology</span>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Investigation</th>
                  <th>Observed Result</th>
                  <th>Units</th>
                  <th>Reference Range</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {r.labTests.map((t, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, color: '#f8fafc' }}>{t.testName}</td>
                    <td style={{ fontWeight: 800, color: t.result ? '#38bdf8' : '#94a3b8' }}>
                      {t.result ?? '—'}
                    </td>
                    <td>{t.unit ?? '—'}</td>
                    <td style={{ color: '#94a3b8' }}>{t.referenceRange ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${t.status === 'Completed' ? 'badge-green' : 'badge-amber'}`}>
                        {t.status === 'Completed' ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Clinical Notes Card ── */}
      {r.notes && (
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(38, 26, 12, 0.95) 0%, rgba(52, 34, 16, 0.88) 100%)',
          borderColor: 'rgba(245, 158, 11, 0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={16} />
            </div>
            <h4 style={{ color: '#fbbf24', fontSize: '0.88rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Physician Remarks &amp; Progress Notes
            </h4>
          </div>
          <p style={{ fontSize: '0.92rem', lineHeight: 1.7, color: '#f1f5f9', whiteSpace: 'pre-line' }}>
            {r.notes}
          </p>
        </div>
      )}

      {/* Modal Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
        <button className="btn btn-secondary" onClick={onClose}>
          Close Record
        </button>
      </div>

    </div>
  );
}
