import React, { useState } from 'react';
import { useClinic } from '../../context/ClinicContext';
import InfoBox from '../../components/AdminLTE/InfoBox';
import ModalPortal from '../../components/ModalPortal';
import { useAuth } from '../../context/AuthContext';
import type { ERCase, EmergencyBay, Priority, TriageAcuity } from '../../types';
import { firstError, validateRequired } from '../../utils/validation';
import { patientCodeFor, patientFullName, patientNameFor } from '../../utils/patient';
import MedicineSearchSelect from '../../components/MedicineSearchSelect';
import {
  AlertTriangle, Activity, Bed, CheckCircle2, ShieldAlert, X,
  Plus, FlaskConical, Pill, Trash2
} from 'lucide-react';

const DEFAULT_ER_BAYS: EmergencyBay[] = [
  { id: 'BAY-01', name: 'Bay 01 (Resus/Trauma 1)', type: 'Critical', oxygenPort: true, active: true },
  { id: 'BAY-02', name: 'Bay 02 (Resus/Trauma 2)', type: 'Critical', oxygenPort: true, active: true },
  { id: 'BAY-03', name: 'Bay 03 (Acute Surgery)', type: 'Acute', oxygenPort: true, active: true },
  { id: 'BAY-04', name: 'Bay 04 (Acute Medical)', type: 'Acute', oxygenPort: true, active: true },
  { id: 'BAY-05', name: 'Bay 05 (Observation)', type: 'Observation', oxygenPort: false, active: true },
  { id: 'BAY-06', name: 'Bay 06 (Observation)', type: 'Observation', oxygenPort: false, active: true },
  { id: 'BAY-07', name: 'Bay 07 (Isolation / Fever)', type: 'Isolation', oxygenPort: true, active: true },
  { id: 'BAY-08', name: 'Bay 08 (Step-down)', type: 'Step-down', oxygenPort: false, active: true },
];

interface EmergencyMedicineLine {
  name: string;
  medicineId?: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string;
  isExternal?: boolean;
}

function emptyMedicineLine(): EmergencyMedicineLine {
  return { name: '', medicineId: undefined, dosage: '', frequency: '', duration: '', quantity: 1, instructions: '' };
}

export default function EmergencyDashboard() {
  const {
    erCases, emergencyBays, patients, medicines,
    addERCase, updateERCase, addEmergencyBay, addLabOrder, addPharmacyOrder,
  } = useClinic();
  const { currentUser } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [bayModalOpen, setBayModalOpen] = useState(false);
  const [labOrderCase, setLabOrderCase] = useState<ERCase | null>(null);
  const [pharmacyOrderCase, setPharmacyOrderCase] = useState<ERCase | null>(null);
  const [selectedCase, setSelectedCase] = useState<ERCase | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [filterAcuity, setFilterAcuity] = useState<string>('All');
  const [bayForm, setBayForm] = useState({ name: '', type: 'Observation', oxygenPort: false });
  const [labForm, setLabForm] = useState({ testName: '', category: 'Hematology', specimenType: 'Blood', priority: 'High' as Priority, notes: '' });
  const [medicineLines, setMedicineLines] = useState<EmergencyMedicineLine[]>([emptyMedicineLine()]);
  const [pharmacyNotes, setPharmacyNotes] = useState('');

  // New emergency admission form
  const [newCase, setNewCase] = useState({
    patientId: '',
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
    attendingDoctor: '',
    criticalNotes: '',
  });

  const bays = emergencyBays.length ? emergencyBays.filter(bay => bay.active) : DEFAULT_ER_BAYS;
  const activeCases = erCases.filter(c => c.status !== 'Discharged' && c.status !== 'Transferred');
  const redCases = activeCases.filter(c => c.acuity === 'Red');
  const yellowCases = activeCases.filter(c => c.acuity === 'Yellow');
  const greenCases = activeCases.filter(c => c.acuity === 'Green');
  const displayedCases = activeCases.filter(c => filterAcuity === 'All' || c.acuity === filterAcuity);

  const handleCreateAdmission = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = firstError(...Object.values(validateRequired(newCase, {
      patientId: 'Patient', chiefComplaint: 'Chief complaint', bedNumber: 'ER bay',
    })));
    if (error) {
      setFormError(error);
      return;
    }
    const patient = patients.find(item => item.id === newCase.patientId);
    if (!patient) {
      setFormError('Select a valid patient from the database.');
      return;
    }
    try {
      const selectedBayName = bays.some(bay => bay.name === newCase.bedNumber)
        ? newCase.bedNumber
        : bays[0]?.name || newCase.bedNumber;
      await addERCase({
        patientId: patient.id,
        patientName: patientFullName(patient),
        age: Math.max(0, new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()),
        gender: patient.gender,
        arrivalMethod: newCase.arrivalMethod,
        acuity: newCase.acuity,
        chiefComplaint: newCase.chiefComplaint,
        bedNumber: selectedBayName,
        vitals: {
          bloodPressure: newCase.bp,
          heartRate: Number(newCase.hr),
          temperature: Number(newCase.temp),
          spo2: Number(newCase.spo2),
        },
        attendingDoctor: currentUser?.name || newCase.attendingDoctor || 'Emergency clinician',
        status: 'In Treatment',
        criticalNotes: newCase.criticalNotes,
      });
      setFormError(null);
      setModalOpen(false);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not create the emergency case.');
    }
  };

  const handleUpdateStatus = async (id: string, status: ERCase['status']) => {
    try {
      await updateERCase(id, { status });
      if (selectedCase && selectedCase.id === id) {
        setSelectedCase({ ...selectedCase, status });
      }
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not update the emergency case.');
    }
  };

  const handleAddBay = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = firstError(...Object.values(validateRequired(bayForm, { name: 'Bay name', type: 'Bay type' })));
    if (error) {
      setOrderError(error);
      return;
    }
    try {
      await addEmergencyBay({ name: bayForm.name.trim(), type: bayForm.type, oxygenPort: bayForm.oxygenPort, active: true });
      setBayForm({ name: '', type: 'Observation', oxygenPort: false });
      setOrderError(null);
      setBayModalOpen(false);
    } catch (cause) {
      setOrderError(cause instanceof Error ? cause.message : 'Could not add the emergency bay.');
    }
  };

  const openLabOrder = (caseItem: ERCase) => {
    setLabOrderCase(caseItem);
    setLabForm({ testName: '', category: 'Hematology', specimenType: 'Blood', priority: caseItem.acuity === 'Red' ? 'Critical' : 'High', notes: '' });
    setOrderError(null);
  };

  const handleLabOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labOrderCase) return;
    const error = firstError(...Object.values(validateRequired(labForm, {
      testName: 'Investigation', category: 'Category', specimenType: 'Specimen type',
    })));
    if (error) {
      setOrderError(error);
      return;
    }
    try {
      await addLabOrder({
        patientId: labOrderCase.patientId,
        patientName: labOrderCase.patientName,
        doctorId: undefined,
        doctorName: currentUser?.name || 'Emergency clinician',
        priority: labForm.priority,
        testName: labForm.testName.trim(),
        category: labForm.category,
        specimenType: labForm.specimenType,
        status: 'Requested',
        notes: labForm.notes.trim(),
      });
      setLabOrderCase(null);
      setOrderError(null);
    } catch (cause) {
      setOrderError(cause instanceof Error ? cause.message : 'Could not send the laboratory order.');
    }
  };

  const openPharmacyOrder = (caseItem: ERCase) => {
    setPharmacyOrderCase(caseItem);
    setMedicineLines([emptyMedicineLine()]);
    setPharmacyNotes('');
    setOrderError(null);
  };

  const handlePharmacyOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pharmacyOrderCase) return;
    const invalidLine = medicineLines.findIndex(line => !line.name.trim() || !line.dosage.trim() || !line.frequency.trim() || !line.duration.trim() || line.quantity < 1);
    if (invalidLine >= 0) {
      setOrderError(`Complete medicine ${invalidLine + 1}: name, dosage, frequency, duration, and quantity are required.`);
      return;
    }
    try {
      await addPharmacyOrder({
        patientId: pharmacyOrderCase.patientId,
        patientName: pharmacyOrderCase.patientName,
        doctorId: undefined,
        doctorName: currentUser?.name || 'Emergency clinician',
        medicines: medicineLines.map(line => ({
          medicineId: line.medicineId,
          name: line.name.trim(),
          dosage: line.dosage.trim(),
          frequency: line.frequency.trim(),
          duration: line.duration.trim(),
          quantity: Number(line.quantity),
          instructions: line.instructions.trim(),
          isExternal: line.isExternal,
        })),
        status: 'Pending',
        notes: pharmacyNotes.trim(),
      });
      setPharmacyOrderCase(null);
      setOrderError(null);
    } catch (cause) {
      setOrderError(cause instanceof Error ? cause.message : 'Could not send the pharmacy order.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Emergency action */}
      <div className="department-action-row" style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          className="btn btn-secondary"
          onClick={() => { setOrderError(null); setBayModalOpen(true); }}
        >
          <Plus size={16} /> Add ER Bay
        </button>
        <div>
          <button
            className="btn btn-danger"
            style={{ boxShadow: '0 0 16px rgba(239,68,68,0.4)', padding: '0.7rem 1.4rem' }}
            onClick={() => setModalOpen(true)}
          >
            <ShieldAlert size={16} /> Fast-Track ER Admission
          </button>
        </div>
      </div>
      {formError && !modalOpen && !labOrderCase && !pharmacyOrderCase && <div className="alert alert-danger py-2 px-3" role="alert">{formError}</div>}

      {/* ER Acuity KPIs */}
      <div className="emergency-kpi-grid">
        <InfoBox
          tone="danger"
          icon={<ShieldAlert size={22} />}
          value={redCases.length}
          label="RED: Critical"
          detail="Immediate resuscitation"
          onClick={() => setFilterAcuity('Red')}
          footerText="Filter RED cases"
        />
        <InfoBox
          tone="warning"
          icon={<AlertTriangle size={22} />}
          value={yellowCases.length}
          label="YELLOW: Urgent"
          detail="Assessed within 15 mins"
          onClick={() => setFilterAcuity('Yellow')}
          footerText="Filter YELLOW cases"
        />
        <InfoBox
          tone="success"
          icon={<Activity size={22} />}
          value={greenCases.length}
          label="GREEN: Non-urgent"
          detail="Stable walking patients"
          onClick={() => setFilterAcuity('Green')}
          footerText="Filter GREEN cases"
        />
        <InfoBox
          tone="info"
          icon={<Bed size={22} />}
          value={`${Math.max(bays.length - activeCases.length, 0)} / ${bays.length}`}
          label="Available ER bays"
          detail={`${activeCases.length} occupied currently`}
          onClick={() => setFilterAcuity('All')}
          footerText="View all bays"
        />
      </div>

      {/* ER Trauma Bays Visual Grid */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Bed size={18} className="text-primary" /> ER Trauma &amp; Observation Bays Map
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
          {bays.map((bay) => {
            const occupant = activeCases.find(c => c.bedNumber === bay.name || c.bedNumber.includes(bay.name));
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
                    {bay.name.split(' (')[0]}
                  </span>
                  <span className={`badge ${isOccupied ? (occupant.acuity === 'Red' ? 'badge-red' : 'badge-amber') : 'badge-green'}`}>
                    {isOccupied ? occupant.acuity.toUpperCase() : 'VACANT'}
                  </span>
                </div>

                <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)', marginBottom: '0.5rem' }}>
                  {bay.name.split('(')[1]?.replace(')', '') || bay.type} {bay.oxygenPort ? '· O2 Port Ready' : ''}
                </div>

                {isOccupied ? (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--clr-text-primary)' }}>
                      {patientNameFor(patients, occupant.patientId, occupant.patientName)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--clr-text-secondary)', marginTop: '0.2rem' }}>
                      {occupant.chiefComplaint}
                    </div>
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>
                      <span>BP: <strong>{occupant.vitals.bloodPressure}</strong></span>
                      <span>SpO2: <strong>{occupant.vitals.spo2}%</strong></span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      style={{ marginTop: '0.65rem', fontSize: '0.72rem' }}
                      onClick={event => {
                        event.stopPropagation();
                        void handleUpdateStatus(occupant.id, 'Discharged');
                      }}
                    >
                      <CheckCircle2 size={12} /> Complete bay
                    </button>
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
              {displayedCases.length === 0 ? (
                <tr className="empty-state-row">
                  <td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-state-icon tone-green">
                        <CheckCircle2 size={28} />
                      </div>
                      <h5 className="empty-state-title">
                        {filterAcuity === 'All' ? 'All clear! No active emergency cases' : `No ${filterAcuity} priority cases`}
                      </h5>
                      <p className="empty-state-body">
                        {filterAcuity === 'All'
                          ? 'There are currently no patients in the Emergency Room. New admissions will appear here automatically when a patient is fast-tracked from reception or OPD.'
                          : `There are currently no active emergency patients classified under ${filterAcuity} triage priority.`}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedCases.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className={`badge ${c.acuity === 'Red' ? 'badge-red' : c.acuity === 'Yellow' ? 'badge-amber' : 'badge-green'}`}>
                        {c.acuity}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--clr-text-primary)' }}>{patientNameFor(patients, c.patientId, c.patientName)}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>{patientCodeFor(patients, c.patientId)} · {c.age} yrs · {c.gender}</div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}>
                        {c.arrivalMethod}
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
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => openLabOrder(c)}
                          title="Order laboratory test"
                        >
                          <FlaskConical size={13} /> Lab
                        </button>
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => openPharmacyOrder(c)}
                          title="Order pharmacy medicines"
                        >
                          <Pill size={13} /> Pharmacy
                        </button>
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
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleUpdateStatus(c.id, 'Discharged')}
                          title="Complete case and free the bay"
                        >
                          <CheckCircle2 size={13} /> Complete
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
        <ModalPortal>
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.96rem' }}>
                <ShieldAlert size={16} style={{ color: '#ef4444' }} /> ER Admission
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateAdmission} noValidate>
              {formError && <div className="alert alert-danger py-2 px-3" role="alert">{formError}</div>}
              <div className="form-grid" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Patient record *</label>
                  <select required value={newCase.patientId} onChange={(e) => setNewCase({ ...newCase, patientId: e.target.value })}>
                    <option value="">Select a patient</option>
                    {patients.map(patient => <option key={patient.id} value={patient.id}>{patientFullName(patient)} · {patientCodeFor(patients, patient.id)}</option>)}
                  </select>
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
                    value={bays.some(bay => bay.name === newCase.bedNumber) ? newCase.bedNumber : bays[0]?.name || ''}
                    onChange={(e) => setNewCase({ ...newCase, bedNumber: e.target.value })}
                  >
                    {bays.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Vitals */}
              <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fca5a5', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={15} /> Vitals
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
        </ModalPortal>
      )}

      {/* Add a new ER bay */}
      {bayModalOpen && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setBayModalOpen(false)}>
            <div className="modal" style={{ maxWidth: 520, width: '100%' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title"><Bed size={17} className="text-primary" /> Add ER Bay</h2>
                <button type="button" className="modal-close-btn" onClick={() => setBayModalOpen(false)} aria-label="Close dialog"><X size={16} /></button>
              </div>
              <form onSubmit={handleAddBay} noValidate>
                {orderError && <div className="alert alert-danger py-2 px-3" role="alert">{orderError}</div>}
                <div className="form-group">
                  <label className="form-label">Bay name *</label>
                  <input value={bayForm.name} onChange={e => setBayForm({ ...bayForm, name: e.target.value })} placeholder="e.g. Bay 09 (Minor Treatment)" />
                </div>
                <div className="form-group">
                  <label className="form-label">Bay type *</label>
                  <select value={bayForm.type} onChange={e => setBayForm({ ...bayForm, type: e.target.value })}>
                    <option>Critical</option>
                    <option>Acute</option>
                    <option>Observation</option>
                    <option>Isolation</option>
                    <option>Step-down</option>
                    <option>Minor Treatment</option>
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0.75rem 0 1rem', fontSize: '0.82rem' }}>
                  <input type="checkbox" checked={bayForm.oxygenPort} onChange={e => setBayForm({ ...bayForm, oxygenPort: e.target.checked })} />
                  Oxygen port available
                </label>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setBayModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary"><Plus size={15} /> Add Bay</button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ER laboratory order */}
      {labOrderCase && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setLabOrderCase(null)}>
            <div className="modal" style={{ maxWidth: 620, width: '100%' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title"><FlaskConical size={17} className="text-primary" /> Order Laboratory Test</h2>
                <button type="button" className="modal-close-btn" onClick={() => setLabOrderCase(null)} aria-label="Close dialog"><X size={16} /></button>
              </div>
              <div style={{ background: 'var(--clr-bg-hover)', borderRadius: 7, padding: '0.65rem 0.8rem', marginBottom: '0.85rem', fontSize: '0.82rem' }}>
                Patient: <strong>{labOrderCase.patientName}</strong> · {labOrderCase.id}
              </div>
              <form onSubmit={handleLabOrder} noValidate>
                {orderError && <div className="alert alert-danger py-2 px-3" role="alert">{orderError}</div>}
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Investigation *</label>
                    <input value={labForm.testName} onChange={e => setLabForm({ ...labForm, testName: e.target.value })} placeholder="e.g. Complete Blood Count" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select value={labForm.category} onChange={e => setLabForm({ ...labForm, category: e.target.value })}>
                      <option>Hematology</option><option>Biochemistry</option><option>Microbiology</option><option>Parasitology</option><option>Urinalysis</option><option>Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Specimen type *</label>
                    <input value={labForm.specimenType} onChange={e => setLabForm({ ...labForm, specimenType: e.target.value })} placeholder="Blood, urine, swab..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select value={labForm.priority} onChange={e => setLabForm({ ...labForm, priority: e.target.value as Priority })}>
                      <option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Instructions</label>
                  <textarea rows={2} value={labForm.notes} onChange={e => setLabForm({ ...labForm, notes: e.target.value })} placeholder="Collection or clinical notes" />
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setLabOrderCase(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary"><FlaskConical size={15} /> Send to Laboratory</button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ER pharmacy order */}
      {pharmacyOrderCase && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setPharmacyOrderCase(null)}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title"><Pill size={17} className="text-primary" /> Order Pharmacy Medicines</h2>
                <button type="button" className="modal-close-btn" onClick={() => setPharmacyOrderCase(null)} aria-label="Close dialog"><X size={16} /></button>
              </div>
              <div style={{ background: 'var(--clr-bg-hover)', borderRadius: 7, padding: '0.65rem 0.8rem', marginBottom: '0.85rem', fontSize: '0.82rem' }}>
                Patient: <strong>{pharmacyOrderCase.patientName}</strong> · {pharmacyOrderCase.id}
              </div>
              <form onSubmit={handlePharmacyOrder} noValidate>
                {orderError && <div className="alert alert-danger py-2 px-3" role="alert">{orderError}</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {medicineLines.map((line, index) => (
                    <div key={index} style={{ border: '1px solid var(--clr-border)', borderRadius: 8, padding: '0.75rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 2fr) repeat(4, minmax(80px, 1fr)) auto', gap: '0.5rem', alignItems: 'end' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Medicine *</label>
                          <MedicineSearchSelect
                            value={line.name}
                            medicineId={line.medicineId}
                            medicines={medicines}
                            onChange={result => setMedicineLines(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, name: result.name, medicineId: result.medicineId, isExternal: result.isCustom } : item))}
                            placeholder="Search medicine"
                            required
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}><label className="form-label">Dosage *</label><input value={line.dosage} onChange={e => setMedicineLines(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, dosage: e.target.value } : item))} placeholder="500 mg" /></div>
                        <div className="form-group" style={{ margin: 0 }}><label className="form-label">Frequency *</label><input value={line.frequency} onChange={e => setMedicineLines(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, frequency: e.target.value } : item))} placeholder="3 times/day" /></div>
                        <div className="form-group" style={{ margin: 0 }}><label className="form-label">Duration *</label><input value={line.duration} onChange={e => setMedicineLines(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, duration: e.target.value } : item))} placeholder="5 days" /></div>
                        <div className="form-group" style={{ margin: 0 }}><label className="form-label">Qty *</label><input type="number" min={1} value={line.quantity} onChange={e => setMedicineLines(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(e.target.value) } : item))} /></div>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={medicineLines.length === 1} onClick={() => setMedicineLines(previous => previous.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove medicine"><Trash2 size={14} /></button>
                      </div>
                      <div className="form-group" style={{ margin: '0.6rem 0 0' }}><label className="form-label">Instructions</label><input value={line.instructions} onChange={e => setMedicineLines(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, instructions: e.target.value } : item))} placeholder="How the patient should take it" /></div>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }} onClick={() => setMedicineLines(previous => [...previous, emptyMedicineLine()])}><Plus size={14} /> Add medicine</button>
                <div className="form-group" style={{ marginTop: '0.75rem' }}><label className="form-label">Notes</label><textarea rows={2} value={pharmacyNotes} onChange={e => setPharmacyNotes(e.target.value)} placeholder="Pharmacy instructions" /></div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setPharmacyOrderCase(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary"><Pill size={15} /> Send to Pharmacy</button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
