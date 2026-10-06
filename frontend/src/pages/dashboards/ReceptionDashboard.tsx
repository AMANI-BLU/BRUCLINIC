import React, { useState } from 'react';
import { useClinic } from '../../context/ClinicContext';
import type { ClinicQueueItem, QueueStage, QueuePriority } from '../../types';
import {
  CreditCard, UserPlus, Users, Search, Plus,
  CheckCircle2, Clock, Activity, HeartPulse, X
} from 'lucide-react';

export default function ReceptionDashboard() {
  const { patients, queue, addToQueue, updateQueueItem, removeFromQueue, addPatient } = useClinic();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formType, setFormType] = useState<'existing' | 'new'>('existing');

  // Form states
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [priority, setPriority] = useState<QueuePriority>('Normal');
  const [stage, setStage] = useState<QueueStage>('Nurse Triage');

  // New patient registration form state
  const [newPatient, setNewPatient] = useState({
    firstName: '',
    lastName: '',
    gender: 'Male' as const,
    dateOfBirth: '2002-01-01',
    phone: '+251',
    email: '',
    address: 'Borana University Campus',
    patientType: 'Student' as const,
    department: '',
    emergencyContactName: '',
    emergencyContactPhone: '+251',
  });

  const studentsCount = patients.filter(p => p.patientType === 'Student').length;
  const staffCount = patients.filter(p => p.patientType === 'Staff').length;

  const filteredQueue = queue.filter(q =>
    q.patientName.toLowerCase().includes(search.toLowerCase()) ||
    q.tokenNumber.toLowerCase().includes(search.toLowerCase()) ||
    (q.department && q.department.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCreateToken = (e: React.FormEvent) => {
    e.preventDefault();

    if (formType === 'existing') {
      const p = patients.find(x => x.id === selectedPatientId);
      if (!p) return;
      addToQueue({
        patientId: p.id,
        patientName: `${p.firstName} ${p.lastName}`,
        patientType: p.patientType,
        department: p.department,
        stage,
        priority,
        chiefComplaint: chiefComplaint || 'Routine medical evaluation',
      });
    } else {
      // Register new patient card first
      addPatient({
        ...newPatient,
        bloodGroup: 'O+',
        allergies: [],
        chronicConditions: [],
      });
      addToQueue({
        patientId: `P${Date.now()}`,
        patientName: `${newPatient.firstName} ${newPatient.lastName}`,
        patientType: newPatient.patientType,
        department: newPatient.department,
        stage,
        priority,
        chiefComplaint: chiefComplaint || 'New patient initial registration',
      });
    }

    setModalOpen(false);
    setChiefComplaint('');
    setSelectedPatientId('');
  };

  const handleForwardStage = (item: ClinicQueueItem, nextStage: QueueStage) => {
    updateQueueItem(item.id, { stage: nextStage });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(12, 28, 54, 0.95) 0%, rgba(14, 40, 78, 0.88) 50%, rgba(10, 22, 45, 0.95) 100%)',
        border: '1px solid rgba(14, 165, 233, 0.28)',
        borderRadius: 16,
        padding: '1.75rem 2rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Ambient background glow */}
        <div style={{
          position: 'absolute', top: -30, right: -20, width: 260, height: 260,
          background: 'radial-gradient(circle, rgba(14, 165, 233, 0.18) 0%, transparent 70%)',
          pointerEvents: 'none', filter: 'blur(35px)'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '0.3rem 0.75rem', borderRadius: 99,
              background: 'rgba(14, 165, 233, 0.18)', border: '1px solid rgba(14, 165, 233, 0.4)',
              color: '#38bdf8', fontSize: '0.74rem', fontWeight: 700,
              letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '0.65rem'
            }}>
              <CreditCard size={14} /> Card Room &amp; Patient Reception Desk
            </div>
            <h1 style={{
              fontSize: '1.85rem', fontWeight: 900, fontFamily: 'var(--font-heading)',
              color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '0.35rem'
            }}>
              Patient Card Registry &amp; Queue Control
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', fontWeight: 500 }}>
              Check-in students &amp; staff, issue clinic record files, and route to OPD or ER triage.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)} style={{ padding: '0.7rem 1.4rem' }}>
            <Plus size={16} /> Issue Card / Queue Token
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="stat-card" style={{ borderColor: 'rgba(14,165,233,0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(14,165,233,0.15)', color: '#0ea5e9' }}>
            <Users size={22} />
          </div>
          <div>
            <div className="stat-value">{queue.length}</div>
            <div className="stat-label">Active Waiting Queue</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>Waiting for triage/OPD</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(59,130,246,0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
            <CreditCard size={22} />
          </div>
          <div>
            <div className="stat-value">{patients.length}</div>
            <div className="stat-label">Archived Patient Files</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>{studentsCount} Students · {staffCount} Staff</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
            <HeartPulse size={22} />
          </div>
          <div>
            <div className="stat-value">{queue.filter(q => q.priority === 'Emergency' || q.stage === 'Emergency').length}</div>
            <div className="stat-label">Emergency Fast-Tracks</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>Bypassed directly to ER</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="stat-value">12 mins</div>
            <div className="stat-label">Avg. Check-In Speed</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>Card retrieval &amp; triage</div>
          </div>
        </div>
      </div>

      {/* Live Queue Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={18} className="text-primary" /> Live Card Room &amp; Triage Dispatch Queue
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)' }}>
              Real-time patient tokens currently in clinic transit
            </span>
          </div>

          <div className="search-bar" style={{ maxWidth: 300 }}>
            <Search size={16} className="icon" />
            <input
              type="text"
              placeholder="Search token, name, department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Token</th>
                <th>Patient Name</th>
                <th>Affiliation / Dept</th>
                <th>Registered</th>
                <th>Chief Complaint</th>
                <th>Priority</th>
                <th>Current Station</th>
                <th>Route Dispatch</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--clr-text-muted)' }}>
                    No patients currently in reception waiting queue
                  </td>
                </tr>
              ) : (
                filteredQueue.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="badge badge-blue" style={{ fontFamily: 'monospace', fontWeight: 800 }}>
                        {item.tokenNumber}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--clr-text-primary)' }}>{item.patientName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>ID: {item.patientId}</div>
                    </td>
                    <td>
                      <div>{item.patientType}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-secondary)' }}>{item.department || 'General'}</div>
                    </td>
                    <td>{item.registeredTime}</td>
                    <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.chiefComplaint}
                    </td>
                    <td>
                      <span className={`badge ${
                        item.priority === 'Emergency' ? 'badge-red' :
                        item.priority === 'Urgent' ? 'badge-amber' : 'badge-blue'
                      }`}>
                        {item.priority}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Activity size={12} /> {item.stage}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          title="Forward to Nurse Triage"
                          onClick={() => handleForwardStage(item, 'Nurse Triage')}
                        >
                          Triage
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          title="Forward to Doctor Consultation"
                          onClick={() => handleForwardStage(item, 'Doctor Consultation')}
                        >
                          Doctor
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          title="Fast-Track to Emergency"
                          onClick={() => handleForwardStage(item, 'Emergency')}
                        >
                          ER
                        </button>
                      </div>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--clr-rose-400)' }}
                        onClick={() => removeFromQueue(item.id)}
                      >
                        Discharge
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Issue Patient Card / Token */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CreditCard size={18} className="text-primary" /> Issue Card &amp; Generate Clinic Token
              </h2>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateToken}>
              {/* Type Switcher */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  className={`btn ${formType === 'existing' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setFormType('existing')}
                >
                  <Search size={15} /> Existing Registered File
                </button>
                <button
                  type="button"
                  className={`btn ${formType === 'new' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setFormType('new')}
                >
                  <UserPlus size={15} /> Issue New Patient Card
                </button>
              </div>

              {formType === 'existing' ? (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Select Patient from Card Directory *</label>
                  <select
                    required
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                  >
                    <option value="">Choose patient file...</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} — {p.patientType} ({p.studentId || p.staffId || p.department || 'ID: ' + p.id})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="form-grid" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input
                      required
                      value={newPatient.firstName}
                      onChange={(e) => setNewPatient({ ...newPatient, firstName: e.target.value })}
                      placeholder="First name"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input
                      required
                      value={newPatient.lastName}
                      onChange={(e) => setNewPatient({ ...newPatient, lastName: e.target.value })}
                      placeholder="Last name"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Patient Type</label>
                    <select
                      value={newPatient.patientType}
                      onChange={(e) => setNewPatient({ ...newPatient, patientType: e.target.value as any })}
                    >
                      <option value="Student">University Student</option>
                      <option value="Staff">Faculty / University Staff</option>
                      <option value="External">External Community</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department / College</label>
                    <input
                      value={newPatient.department}
                      onChange={(e) => setNewPatient({ ...newPatient, department: e.target.value })}
                      placeholder="e.g. Computer Science, Nursing"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number *</label>
                    <input
                      required
                      value={newPatient.phone}
                      onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                      placeholder="+251..."
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Emergency Contact Phone</label>
                    <input
                      value={newPatient.emergencyContactPhone}
                      onChange={(e) => setNewPatient({ ...newPatient, emergencyContactPhone: e.target.value })}
                      placeholder="+251..."
                    />
                  </div>
                </div>
              )}

              <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Triage Priority</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value as QueuePriority)}>
                    <option value="Normal">Normal (Routine OPD)</option>
                    <option value="Urgent">Urgent (Priority Triage)</option>
                    <option value="Emergency">Emergency (Immediate ER Alert)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Initial Destination Station</label>
                  <select value={stage} onChange={(e) => setStage(e.target.value as QueueStage)}>
                    <option value="Nurse Triage">Nurse Station (Vitals &amp; Triage)</option>
                    <option value="Doctor Consultation">OPD Doctor Direct Consultation</option>
                    <option value="Emergency">Emergency Room (ER) Fast-Track</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Chief Complaint / Reason for Visit *</label>
                <textarea
                  rows={2}
                  required
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="e.g. High fever, headache, minor injury, inhaler refill..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <CheckCircle2 size={16} /> Issue Card &amp; Print Token
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
