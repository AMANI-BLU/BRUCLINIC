import React, { useState } from 'react';
import { useClinic } from '../../context/ClinicContext';
import type { ERCase, TriageAcuity } from '../../types';
import {
  HeartPulse, AlertTriangle, Activity, Bed,
  CheckCircle2, Ambulance, ShieldAlert, X
} from 'lucide-react';

const ER_BAYS = [
  { id: 'Bay 01', name: 'Bay 01 (Resus/Trauma 1)', type: 'Critical', oxy: true },
  { id: 'Bay 02', name: 'Bay 02 (Resus/Trauma 2)', type: 'Critical', oxy: true },
  { id: 'Bay 03', name: 'Bay 03 (Acute Surgery)', type: 'Acute', oxy: true },
  { id: 'Bay 04', name: 'Bay 04 (Acute Medical)', type: 'Acute', oxy: true },
  { id: 'Bay 05', name: 'Bay 05 (Observation)', type: 'Observation', oxy: false },
  { id: 'Bay 06', name: 'Bay 06 (Observation)', type: 'Observation', oxy: false },
  { id: 'Bay 07', name: 'Bay 07 (Isolation / Fever)', type: 'Isolation', oxy: true },
  { id: 'Bay 08', name: 'Bay 08 (Step-down)', type: 'Step-down', oxy: false },
];

export default function EmergencyDashboard() {
  const { erCases, addERCase, updateERCase } = useClinic();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<ERCase | null>(null);

  // New emergency admission form
  const [newCase, setNewCase] = useState({
    patientName: '',
    age: 22,
    gender: 'Male' as const,
    arrivalMethod: 'Ambulance' as const,
    acuity: 'Red' as TriageAcuity,
    chiefComplaint: '',
    bedNumber: 'Bay 02 (Resus/Trauma 2)',
    bp: '110/70',
    hr: 110,
    temp: 37.2,
    spo2: 92,
    attendingDoctor: 'Dr. Teshome Galgalo',
    criticalNotes: '',
  });

  const redCases = erCases.filter(c => c.acuity === 'Red');
  const yellowCases = erCases.filter(c => c.acuity === 'Yellow');
  const greenCases = erCases.filter(c => c.acuity === 'Green');

  const handleCreateAdmission = (e: React.FormEvent) => {
    e.preventDefault();
    addERCase({
      patientId: `P${Date.now()}`,
      patientName: newCase.patientName || 'Emergency Patient',
      age: Number(newCase.age),
      gender: newCase.gender,
      arrivalMethod: newCase.arrivalMethod,
      acuity: newCase.acuity,
      chiefComplaint: newCase.chiefComplaint || 'Acute trauma presentation',
      bedNumber: newCase.bedNumber,
      vitals: {
        bloodPressure: newCase.bp,
        heartRate: Number(newCase.hr),
        temperature: Number(newCase.temp),
        spo2: Number(newCase.spo2),
      },
      attendingDoctor: newCase.attendingDoctor,
      status: 'In Treatment',
      criticalNotes: newCase.criticalNotes,
    });
    setModalOpen(false);
  };

  const handleUpdateStatus = (id: string, status: ERCase['status']) => {
    updateERCase(id, { status });
    if (selectedCase && selectedCase.id === id) {
      setSelectedCase({ ...selectedCase, status });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(38, 14, 25, 0.95) 0%, rgba(55, 18, 30, 0.88) 50%, rgba(28, 10, 20, 0.95) 100%)',
        border: '1px solid rgba(244, 63, 94, 0.3)',
        borderRadius: 16,
        padding: '1.75rem 2rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Ambient background glow */}
        <div style={{
          position: 'absolute', top: -30, right: -20, width: 260, height: 260,
          background: 'radial-gradient(circle, rgba(244, 63, 94, 0.18) 0%, transparent 70%)',
          pointerEvents: 'none', filter: 'blur(35px)'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '0.3rem 0.75rem', borderRadius: 99,
              background: 'rgba(244, 63, 94, 0.18)', border: '1px solid rgba(244, 63, 94, 0.4)',
              color: '#fb7185', fontSize: '0.74rem', fontWeight: 700,
              letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '0.65rem'
            }}>
              <HeartPulse size={14} /> Emergency Trauma &amp; Resuscitation Unit (ER)
            </div>
            <h1 style={{
              fontSize: '1.85rem', fontWeight: 900, fontFamily: 'var(--font-heading)',
              color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '0.35rem'
            }}>
              Emergency Triage &amp; Trauma Bay Management
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', fontWeight: 500 }}>
              Real-time acuity triage, active trauma resuscitation tracking, bed occupancy, and fast-track admissions.
            </p>
          </div>
          <button
            className="btn btn-danger"
            style={{ boxShadow: '0 0 16px rgba(239,68,68,0.4)', padding: '0.7rem 1.4rem' }}
            onClick={() => setModalOpen(true)}
          >
            <ShieldAlert size={16} /> Fast-Track ER Admission
          </button>
        </div>
      </div>

      {/* ER Acuity KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="stat-card" style={{ borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.05)' }}>
          <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
            <ShieldAlert size={22} />
          </div>
          <div>
            <div className="stat-value" style={{ color: '#ef4444' }}>{redCases.length}</div>
            <div className="stat-label">RED: Immediate Resuscitation</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>Continuous monitoring required</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.05)' }}>
          <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <div className="stat-value" style={{ color: '#f59e0b' }}>{yellowCases.length}</div>
            <div className="stat-label">YELLOW: Emergent / Urgent</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>Assessed within 15 minutes</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(16,185,129,0.4)' }}>
          <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981' }}>
            <Activity size={22} />
          </div>
          <div>
            <div className="stat-value">{greenCases.length}</div>
            <div className="stat-label">GREEN: Non-Urgent Minor</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>Stable walking patients</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(59,130,246,0.4)' }}>
          <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.2)', color: '#3b82f6' }}>
            <Bed size={22} />
          </div>
          <div>
            <div className="stat-value">{ER_BAYS.length - erCases.length} / {ER_BAYS.length}</div>
            <div className="stat-label">Available ER Bays</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>{erCases.length} Occupied currently</div>
          </div>
        </div>
      </div>

      {/* ER Trauma Bays Visual Grid */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Bed size={18} className="text-primary" /> ER Trauma &amp; Observation Bays Map
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1rem' }}>
          {ER_BAYS.map((bay) => {
            const occupant = erCases.find(c => c.bedNumber.includes(bay.id));
            const isOccupied = !!occupant;

            return (
              <div
                key={bay.id}
                onClick={() => occupant && setSelectedCase(occupant)}
                style={{
                  border: isOccupied
                    ? occupant.acuity === 'Red'
                      ? '2px solid rgba(239,68,68,0.7)'
                      : '2px solid rgba(245,158,11,0.6)'
                    : '1px dashed var(--clr-border)',
                  background: isOccupied
                    ? occupant.acuity === 'Red'
                      ? 'rgba(239,68,68,0.08)'
                      : 'rgba(245,158,11,0.05)'
                    : 'var(--clr-bg-card)',
                  borderRadius: 10,
                  padding: '1rem',
                  cursor: isOccupied ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--clr-text-primary)' }}>
                    {bay.id}
                  </span>
                  <span className={`badge ${isOccupied ? (occupant.acuity === 'Red' ? 'badge-red' : 'badge-amber') : 'badge-green'}`}>
                    {isOccupied ? occupant.acuity.toUpperCase() : 'VACANT'}
                  </span>
                </div>

                <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)', marginBottom: '0.5rem' }}>
                  {bay.name.split('(')[1]?.replace(')', '') || bay.type} {bay.oxy ? '· O2 Port Ready' : ''}
                </div>

                {isOccupied ? (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--clr-text-primary)' }}>
                      {occupant.patientName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--clr-text-secondary)', marginTop: '0.2rem' }}>
                      {occupant.chiefComplaint}
                    </div>
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>
                      <span>BP: <strong>{occupant.vitals.bloodPressure}</strong></span>
                      <span>SpO2: <strong>{occupant.vitals.spo2}%</strong></span>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)', marginTop: '0.5rem', fontStyle: 'italic' }}>
                    Bay sanitized &amp; available
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active ER Patient Records Table */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={18} className="text-primary" /> Active Emergency Patients in Unit
        </h3>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Acuity</th>
                <th>Patient</th>
                <th>Arrival Mode</th>
                <th>Assigned Bay</th>
                <th>Chief Complaint &amp; Vitals</th>
                <th>Attending MD</th>
                <th>Current Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {erCases.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--clr-text-muted)' }}>
                    No active emergency cases currently in ER
                  </td>
                </tr>
              ) : (
                erCases.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className={`badge ${c.acuity === 'Red' ? 'badge-red' : c.acuity === 'Yellow' ? 'badge-amber' : 'badge-green'}`}>
                        {c.acuity}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--clr-text-primary)' }}>{c.patientName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>{c.age} yrs · {c.gender}</div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}>
                        <Ambulance size={14} className="text-primary" /> {c.arrivalMethod}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-blue">{c.bedNumber.split(' ')[0]} {c.bedNumber.split(' ')[1]}</span>
                    </td>
                    <td>
                      <div style={{ maxWidth: 220, fontSize: '0.8rem' }}>{c.chiefComplaint}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)', marginTop: 2 }}>
                        BP {c.vitals.bloodPressure} · HR {c.vitals.heartRate} · SpO2 {c.vitals.spo2}%
                      </div>
                    </td>
                    <td>{c.attendingDoctor}</td>
                    <td>
                      <span className="badge badge-green">{c.status}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleUpdateStatus(c.id, 'Stabilized')}
                        >
                          Stabilize
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleUpdateStatus(c.id, 'Admitted to Ward')}
                        >
                          Ward
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Fast-Track ER Admission */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={18} style={{ color: '#ef4444' }} /> Rapid Fast-Track ER Admission
              </h2>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateAdmission}>
              <div className="form-grid" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Patient Full Name *</label>
                  <input
                    required
                    value={newCase.patientName}
                    onChange={(e) => setNewCase({ ...newCase, patientName: e.target.value })}
                    placeholder="Enter patient name"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Estimated Age</label>
                  <input
                    type="number"
                    value={newCase.age}
                    onChange={(e) => setNewCase({ ...newCase, age: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    value={newCase.gender}
                    onChange={(e) => setNewCase({ ...newCase, gender: e.target.value as any })}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Arrival Method</label>
                  <select
                    value={newCase.arrivalMethod}
                    onChange={(e) => setNewCase({ ...newCase, arrivalMethod: e.target.value as any })}
                  >
                    <option value="Ambulance">University Ambulance</option>
                    <option value="OPD Referral">OPD Clinic Referral</option>
                    <option value="Walk-in">Campus Emergency Walk-in</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Triage Acuity Code *</label>
                  <select
                    value={newCase.acuity}
                    onChange={(e) => setNewCase({ ...newCase, acuity: e.target.value as any })}
                    style={{ fontWeight: 700 }}
                  >
                    <option value="Red">RED - Resuscitation / Immediate Life Threat</option>
                    <option value="Yellow">YELLOW - Emergent / Severe Trauma</option>
                    <option value="Green">GREEN - Non-Urgent Minor</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Assign ER Bay *</label>
                  <select
                    value={newCase.bedNumber}
                    onChange={(e) => setNewCase({ ...newCase, bedNumber: e.target.value })}
                  >
                    {ER_BAYS.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Vitals */}
              <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fca5a5', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={15} /> Immediate ER Vitals
                </h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Blood Pressure</label>
                    <input
                      value={newCase.bp}
                      onChange={(e) => setNewCase({ ...newCase, bp: e.target.value })}
                      placeholder="110/70"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Heart Rate (bpm)</label>
                    <input
                      type="number"
                      value={newCase.hr}
                      onChange={(e) => setNewCase({ ...newCase, hr: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SpO2 Oxygen (%)</label>
                    <input
                      type="number"
                      value={newCase.spo2}
                      onChange={(e) => setNewCase({ ...newCase, spo2: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Temperature (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newCase.temp}
                      onChange={(e) => setNewCase({ ...newCase, temp: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Chief Complaint &amp; Acute Presentation *</label>
                <textarea
                  rows={2}
                  required
                  value={newCase.chiefComplaint}
                  onChange={(e) => setNewCase({ ...newCase, chiefComplaint: e.target.value })}
                  placeholder="e.g. Deep laceration with arterial bleed, acute anaphylaxis, severe dyspnea..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  <CheckCircle2 size={16} /> Admit Patient to ER Bay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
