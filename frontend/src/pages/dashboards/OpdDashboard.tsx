import React, { useState } from 'react';
import { useClinic } from '../../context/ClinicContext';
import type { ClinicQueueItem, Vitals } from '../../types';
import {
  Stethoscope, Activity, Pill, FlaskConical, CheckCircle2,
  FileText, ChevronRight, X
} from 'lucide-react';

export default function OpdDashboard() {
  const {
    queue, updateQueueItem,
    addRecord, addPharmacyOrder, addLabOrder
  } = useClinic();

  const [activeStation, setActiveStation] = useState<'doctor' | 'nurse'>('doctor');
  const [selectedQueueItem, setSelectedQueueItem] = useState<ClinicQueueItem | null>(null);

  // Nurse vitals form
  const [vitalsForm, setVitalsForm] = useState<Vitals>({
    bloodPressure: '120/80',
    heartRate: 75,
    temperature: 36.8,
    spo2: 98,
    respiratoryRate: 18,
    weightKg: 65,
  });

  // Doctor consultation form
  const [consultation, setConsultation] = useState({
    diagnosis: '',
    symptoms: '',
    clinicalNotes: '',
    prescriptionDrug: '',
    dosage: '500mg',
    frequency: '3x daily',
    duration: '5 days',
    quantity: 15,
    orderLabTest: false,
    labTestName: 'Complete Blood Count (CBC)',
    labCategory: 'Hematology' as const,
  });

  const waitingForNurse = queue.filter(q => q.stage === 'Nurse Triage' || q.stage === 'Reception');
  const waitingForDoctor = queue.filter(q => q.stage === 'Doctor Consultation');

  const handleSaveNurseVitals = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueueItem) return;
    updateQueueItem(selectedQueueItem.id, {
      vitals: vitalsForm,
      stage: 'Doctor Consultation',
    });
    setSelectedQueueItem(null);
  };

  const handleCompleteDoctorConsultation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueueItem) return;

    // 1. Add to medical records
    addRecord({
      patientId: selectedQueueItem.patientId,
      patientName: selectedQueueItem.patientName,
      doctorId: 'D001',
      doctorName: 'Dr. Bikila Negassa',
      visitDate: new Date().toISOString().split('T')[0],
      diagnosis: consultation.diagnosis || 'Clinical evaluation completed',
      symptoms: consultation.symptoms ? consultation.symptoms.split(',').map(s => s.trim()) : [selectedQueueItem.chiefComplaint],
      notes: consultation.clinicalNotes,
      prescription: consultation.prescriptionDrug ? [{
        medication: consultation.prescriptionDrug,
        dosage: consultation.dosage,
        frequency: consultation.frequency,
        duration: consultation.duration,
      }] : [],
    });

    // 2. If prescription added, flow directly to Pharmacy queue!
    if (consultation.prescriptionDrug) {
      addPharmacyOrder({
        patientId: selectedQueueItem.patientId,
        patientName: selectedQueueItem.patientName,
        doctorId: 'D001',
        doctorName: 'Dr. Bikila Negassa',
        medicines: [{
          name: consultation.prescriptionDrug,
          dosage: consultation.dosage,
          frequency: consultation.frequency,
          duration: consultation.duration,
          quantity: consultation.quantity,
          instructions: 'Take as instructed by OPD physician',
        }],
        status: 'Pending',
      });
    }

    // 3. If lab test ordered, flow directly to Laboratory queue!
    if (consultation.orderLabTest && consultation.labTestName) {
      addLabOrder({
        patientId: selectedQueueItem.patientId,
        patientName: selectedQueueItem.patientName,
        doctorId: 'D001',
        doctorName: 'Dr. Bikila Negassa',
        priority: 'High',
        testName: consultation.labTestName,
        category: consultation.labCategory,
        specimenType: 'Venous Blood',
        status: 'Requested',
        notes: `OPD clinical referral: ${consultation.diagnosis}`,
      });
    }

    // Advance queue item stage or complete
    updateQueueItem(selectedQueueItem.id, {
      stage: consultation.orderLabTest ? 'Laboratory' : consultation.prescriptionDrug ? 'Pharmacy' : 'Completed',
    });

    setSelectedQueueItem(null);
    setConsultation({
      diagnosis: '',
      symptoms: '',
      clinicalNotes: '',
      prescriptionDrug: '',
      dosage: '500mg',
      frequency: '3x daily',
      duration: '5 days',
      quantity: 15,
      orderLabTest: false,
      labTestName: 'Complete Blood Count (CBC)',
      labCategory: 'Hematology',
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(10, 32, 45, 0.95) 0%, rgba(13, 44, 58, 0.88) 50%, rgba(8, 26, 38, 0.95) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.28)',
        borderRadius: 16,
        padding: '1.75rem 2rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Ambient background glow */}
        <div style={{
          position: 'absolute', top: -30, right: -20, width: 260, height: 260,
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, transparent 70%)',
          pointerEvents: 'none', filter: 'blur(35px)'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '0.3rem 0.75rem', borderRadius: 99,
              background: 'rgba(16, 185, 129, 0.18)', border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#34d399', fontSize: '0.74rem', fontWeight: 700,
              letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '0.65rem'
            }}>
              <Stethoscope size={14} /> Outpatient Department (OPD Clinic)
            </div>
            <h1 style={{
              fontSize: '1.85rem', fontWeight: 900, fontFamily: 'var(--font-heading)',
              color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '0.35rem'
            }}>
              Doctor &amp; Nurse Clinical Station
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', fontWeight: 500 }}>
              Conduct consultations, record patient vital signs, transmit electronic prescriptions and order lab diagnostics.
            </p>
          </div>

          {/* Station Switcher */}
          <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.35)', padding: 4, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.1)', gap: 4 }}>
            <button
              className={`btn btn-sm ${activeStation === 'doctor' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setActiveStation('doctor'); setSelectedQueueItem(null); }}
              style={{ borderRadius: 7, padding: '0.45rem 0.85rem' }}
            >
              <Stethoscope size={14} /> Doctor Station ({waitingForDoctor.length})
            </button>
            <button
              className={`btn btn-sm ${activeStation === 'nurse' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setActiveStation('nurse'); setSelectedQueueItem(null); }}
              style={{ borderRadius: 7, padding: '0.45rem 0.85rem' }}
            >
              <Activity size={14} /> Nurse Station ({waitingForNurse.length})
            </button>
          </div>
        </div>
      </div>

      {/* OPD KPI Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="stat-card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            <Stethoscope size={22} />
          </div>
          <div>
            <div className="stat-value">{waitingForDoctor.length}</div>
            <div className="stat-label">Waiting for Doctor</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>Vitals ready for consult</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(59,130,246,0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
            <Activity size={22} />
          </div>
          <div>
            <div className="stat-value">{waitingForNurse.length}</div>
            <div className="stat-label">Nurse Triage Queue</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>Awaiting vitals check</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(245,158,11,0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
            <Pill size={22} />
          </div>
          <div>
            <div className="stat-value">OPD Rx Direct</div>
            <div className="stat-label">Pharmacy Auto-Sync</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>Orders routed instantly</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(139,92,246,0.3)' }}>
          <div className="stat-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
            <FlaskConical size={22} />
          </div>
          <div>
            <div className="stat-value">Lab Auto-Sync</div>
            <div className="stat-label">Diagnostic Ordering</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>Direct specimen request</div>
          </div>
        </div>
      </div>

      {/* Main OPD Station Work Area */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedQueueItem ? '1fr 1.3fr' : '1fr', gap: '1.25rem' }}>
        {/* Patient Queue List */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              {activeStation === 'doctor' ? (
                <><Stethoscope size={18} className="text-primary" /> Ready for Doctor Consultation</>
              ) : (
                <><Activity size={18} className="text-primary" /> Nurse Vitals &amp; Triage Waiting List</>
              )}
            </h3>
            <span className="badge badge-blue">
              {activeStation === 'doctor' ? waitingForDoctor.length : waitingForNurse.length} Patients
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(activeStation === 'doctor' ? waitingForDoctor : waitingForNurse).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--clr-text-muted)', fontSize: '0.875rem' }}>
                No patients currently in this OPD queue.
              </div>
            ) : (
              (activeStation === 'doctor' ? waitingForDoctor : waitingForNurse).map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedQueueItem(item)}
                  style={{
                    padding: '1rem',
                    borderRadius: 8,
                    border: selectedQueueItem?.id === item.id ? '2px solid var(--clr-primary-400)' : '1px solid var(--clr-border)',
                    background: selectedQueueItem?.id === item.id ? 'rgba(37,99,235,0.08)' : 'var(--clr-bg-card)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="badge badge-blue" style={{ fontFamily: 'monospace', fontWeight: 800 }}>
                        {item.tokenNumber}
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--clr-text-primary)' }}>{item.patientName}</span>
                    </div>
                    <span className={`badge ${item.priority === 'Urgent' ? 'badge-amber' : 'badge-green'}`}>
                      {item.priority}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-secondary)', marginBottom: '0.5rem' }}>
                    {item.chiefComplaint}
                  </div>

                  {item.vitals && (
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.72rem', color: 'var(--clr-text-muted)', background: 'rgba(255,255,255,0.03)', padding: '0.35rem 0.6rem', borderRadius: 4 }}>
                      <span>BP: <strong>{item.vitals.bloodPressure || '—'}</strong></span>
                      <span>HR: <strong>{item.vitals.heartRate ? `${item.vitals.heartRate} bpm` : '—'}</strong></span>
                      <span>Temp: <strong>{item.vitals.temperature ? `${item.vitals.temperature}°C` : '—'}</strong></span>
                      <span>SpO2: <strong>{item.vitals.spo2 ? `${item.vitals.spo2}%` : '—'}</strong></span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--clr-primary-400)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {activeStation === 'doctor' ? 'Open Consultation' : 'Record Vitals'} <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected Patient Action Workspace */}
        {selectedQueueItem && (
          <div className="card" style={{ borderColor: 'rgba(59,130,246,0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--clr-border)' }}>
              <div>
                <span className="badge badge-blue">{selectedQueueItem.tokenNumber}</span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '0.25rem' }}>
                  {selectedQueueItem.patientName}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)' }}>
                  Affiliation: {selectedQueueItem.patientType} · {selectedQueueItem.department || 'General'}
                </span>
              </div>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setSelectedQueueItem(null)}>
                <X size={16} />
              </button>
            </div>

            {/* ── NURSE FORM ── */}
            {activeStation === 'nurse' && (
              <form onSubmit={handleSaveNurseVitals}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={16} className="text-primary" /> Clinical Triage Vitals Entry
                </h4>

                <div className="form-grid" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Blood Pressure (mmHg)</label>
                    <input
                      required
                      value={vitalsForm.bloodPressure}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, bloodPressure: e.target.value })}
                      placeholder="120/80"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Heart Rate (bpm)</label>
                    <input
                      type="number"
                      value={vitalsForm.heartRate}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, heartRate: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Body Temperature (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={vitalsForm.temperature}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Oxygen Saturation SpO2 (%)</label>
                    <input
                      type="number"
                      value={vitalsForm.spo2}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, spo2: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Weight (kg)</label>
                    <input
                      type="number"
                      value={vitalsForm.weightKg}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, weightKg: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Respiratory Rate (/min)</label>
                    <input
                      type="number"
                      value={vitalsForm.respiratoryRate}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, respiratoryRate: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedQueueItem(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <CheckCircle2 size={16} /> Save Vitals &amp; Forward to Doctor
                  </button>
                </div>
              </form>
            )}

            {/* ── DOCTOR FORM ── */}
            {activeStation === 'doctor' && (
              <form onSubmit={handleCompleteDoctorConsultation}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={16} className="text-primary" /> Doctor Consultation &amp; Prescription
                </h4>

                <div className="form-grid" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Primary Diagnosis *</label>
                    <input
                      required
                      value={consultation.diagnosis}
                      onChange={(e) => setConsultation({ ...consultation, diagnosis: e.target.value })}
                      placeholder="e.g. Acute Bronchitis, Tension Headache, Gastritis"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Symptoms Noted</label>
                    <input
                      value={consultation.symptoms}
                      onChange={(e) => setConsultation({ ...consultation, symptoms: e.target.value })}
                      placeholder="Cough, low grade fever, malaise"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Clinical Notes &amp; Management Plan</label>
                  <textarea
                    rows={2}
                    value={consultation.clinicalNotes}
                    onChange={(e) => setConsultation({ ...consultation, clinicalNotes: e.target.value })}
                    placeholder="Patient examination findings, physical check, advice..."
                  />
                </div>

                {/* E-Prescription Section */}
                <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
                  <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--clr-amber-400)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.5rem' }}>
                    <Pill size={15} /> Send Electronic Prescription to Pharmacy
                  </h5>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Medication Name</label>
                      <input
                        value={consultation.prescriptionDrug}
                        onChange={(e) => setConsultation({ ...consultation, prescriptionDrug: e.target.value })}
                        placeholder="e.g. Amoxicillin, Paracetamol, Ibuprofen"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Dosage &amp; Frequency</label>
                      <input
                        value={consultation.dosage}
                        onChange={(e) => setConsultation({ ...consultation, dosage: e.target.value })}
                        placeholder="500mg - 3x daily"
                      />
                    </div>
                  </div>
                </div>

                {/* Lab Order Section */}
                <div style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={consultation.orderLabTest}
                      onChange={(e) => setConsultation({ ...consultation, orderLabTest: e.target.checked })}
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--clr-accent-400)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FlaskConical size={15} /> Send Diagnostic Test Order to Laboratory
                    </span>
                  </label>

                  {consultation.orderLabTest && (
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Test Name</label>
                        <select
                          value={consultation.labTestName}
                          onChange={(e) => setConsultation({ ...consultation, labTestName: e.target.value })}
                        >
                          <option value="Complete Blood Count (CBC)">Complete Blood Count (CBC)</option>
                          <option value="Blood Smear for Malaria Parasite (BSMP)">Malaria Smear (BSMP)</option>
                          <option value="Random Blood Sugar (RBS)">Random Blood Sugar (RBS)</option>
                          <option value="Urinalysis Routine">Urinalysis Routine</option>
                          <option value="Widal Test">Widal Test for Typhoid</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Category</label>
                        <select
                          value={consultation.labCategory}
                          onChange={(e) => setConsultation({ ...consultation, labCategory: e.target.value as any })}
                        >
                          <option value="Hematology">Hematology</option>
                          <option value="Parasitology">Parasitology</option>
                          <option value="Biochemistry">Biochemistry</option>
                          <option value="Urinalysis">Urinalysis</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedQueueItem(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <CheckCircle2 size={16} /> Complete Consultation &amp; Dispatch Orders
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
