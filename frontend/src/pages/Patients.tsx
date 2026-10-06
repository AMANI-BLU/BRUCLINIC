import { useState } from 'react';
import { useClinic } from '../context/ClinicContext';
import type { Patient, Gender, BloodGroup, PatientType } from '../types';
import { Search, Trash2, Edit2, Eye, X, UserPlus, Users } from 'lucide-react';
import './Patients.css';

const EMPTY_PATIENT: Omit<Patient, 'id' | 'registeredAt'> = {
  firstName: '', lastName: '', gender: 'Male', dateOfBirth: '',
  phone: '', email: '', address: '', patientType: 'Student',
  department: '', bloodGroup: 'O+', allergies: [], chronicConditions: [],
  emergencyContactName: '', emergencyContactPhone: '',
};

type ModalMode = 'view' | 'add' | 'edit' | null;

export default function Patients() {
  const { patients, addPatient, updatePatient, deletePatient } = useClinic();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<PatientType | 'All'>('All');
  const [modal, setModal] = useState<{ mode: ModalMode; patient?: Patient }>({ mode: null });
  const [form, setForm] = useState<Omit<Patient, 'id' | 'registeredAt'>>(EMPTY_PATIENT);

  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = `${p.firstName} ${p.lastName} ${p.studentId ?? ''} ${p.staffId ?? ''} ${p.department ?? ''}`.toLowerCase().includes(q);
    const matchType = filterType === 'All' || p.patientType === filterType;
    return matchSearch && matchType;
  });

  const openAdd = () => { setForm(EMPTY_PATIENT); setModal({ mode: 'add' }); };
  const openEdit = (p: Patient) => { setForm({ ...p }); setModal({ mode: 'edit', patient: p }); };
  const openView = (p: Patient) => setModal({ mode: 'view', patient: p });
  const close = () => setModal({ mode: null });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modal.mode === 'add') addPatient(form);
    else if (modal.mode === 'edit' && modal.patient) updatePatient(modal.patient.id, form);
    close();
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this patient record?')) deletePatient(id);
  };

  const typeColor = (t: PatientType) =>
    t === 'Student' ? 'badge-blue' : t === 'Staff' ? 'badge-emerald' : 'badge-amber';

  const initials = (p: Patient) =>
    `${p.firstName[0] ?? ''}${p.lastName[0] ?? ''}`.toUpperCase();

  const avatarBg = (id: string) => {
    const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9'];
    return colors[id.charCodeAt(1) % colors.length];
  };

  return (
    <div className="patients-page">
      <div className="page-header">
        <div>
          <h1 className="page-title"><Users size={26} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />Patients</h1>
          <p className="page-subtitle">{patients.length} registered patients</p>
        </div>
        <button className="btn btn-primary" id="add-patient-btn" onClick={openAdd}>
          <UserPlus size={16} /> Register Patient
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-bar">
          <Search size={16} className="icon" />
          <input
            id="patient-search"
            placeholder="Search by name, ID or department…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="pill-tabs">
          {(['All', 'Student', 'Staff', 'External'] as const).map(t => (
            <button key={t} className={`pill-tab ${filterType === t ? 'active' : ''}`} onClick={() => setFilterType(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>ID</th>
              <th>Type</th>
              <th>Department</th>
              <th>Contact</th>
              <th>Blood</th>
              <th>Registered</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--clr-text-muted)' }}>No patients found.</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
                <td>
                  <div className="patient-cell">
                    <div className="avatar" style={{ background: avatarBg(p.id) }}>{initials(p)}</div>
                    <div>
                      <div className="patient-name">{p.firstName} {p.lastName}</div>
                      <div className="patient-sub">{p.email}</div>
                    </div>
                  </div>
                </td>
                <td><code className="id-code">{p.studentId ?? p.staffId ?? p.id}</code></td>
                <td><span className={`badge ${typeColor(p.patientType)}`}>{p.patientType}</span></td>
                <td>{p.department ?? '—'}</td>
                <td>{p.phone}</td>
                <td><span className="badge badge-blue">{p.bloodGroup ?? '?'}</span></td>
                <td>{p.registeredAt}</td>
                <td>
                  <div className="action-btns">
                    <button className="btn btn-secondary btn-sm btn-icon" title="View" onClick={() => openView(p)}><Eye size={15} /></button>
                    <button className="btn btn-secondary btn-sm btn-icon" title="Edit" onClick={() => openEdit(p)}><Edit2 size={15} /></button>
                    <button className="btn btn-danger btn-sm btn-icon" title="Delete" onClick={() => handleDelete(p.id)}><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal.mode && (
        <div className="modal-overlay" onClick={close}>
          <div className={`modal ${modal.mode === 'view' ? 'modal-lg' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {modal.mode === 'add' ? <><UserPlus size={18} className="text-primary" /> Register New Patient</> :
                 modal.mode === 'edit' ? <><Edit2 size={18} className="text-primary" /> Edit Patient</> :
                 <><Eye size={18} className="text-primary" /> Patient Details</>}
              </h2>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={close}><X size={16} /></button>
            </div>

            {modal.mode === 'view' && modal.patient ? (
              <PatientView patient={modal.patient} />
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="form-grid" style={{ marginTop: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input required value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="First name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input required value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Last name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Patient Type *</label>
                    <select value={form.patientType} onChange={e => setForm(f => ({ ...f, patientType: e.target.value as PatientType }))}>
                      <option>Student</option><option>Staff</option><option>External</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gender *</label>
                    <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value as Gender }))}>
                      <option>Male</option><option>Female</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Blood Group</label>
                    <select value={form.bloodGroup ?? ''} onChange={e => setForm(f => ({ ...f, bloodGroup: e.target.value as BloodGroup }))}>
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => <option key={bg}>{bg}</option>)}
                    </select>
                  </div>
                  {form.patientType === 'Student' && (
                    <div className="form-group">
                      <label className="form-label">Student ID</label>
                      <input value={form.studentId ?? ''} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} placeholder="BU/2024/xxx" />
                    </div>
                  )}
                  {form.patientType === 'Staff' && (
                    <div className="form-group">
                      <label className="form-label">Staff ID</label>
                      <input value={form.staffId ?? ''} onChange={e => setForm(f => ({ ...f, staffId: e.target.value }))} placeholder="BU/STAFF/xxx" />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input value={form.department ?? ''} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g. Computer Science" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone *</label>
                    <input required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+251…" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="patient@boru.edu.et" />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Address</label>
                    <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="City, Zone, Region" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Emergency Contact Name</label>
                    <input value={form.emergencyContactName} onChange={e => setForm(f => ({ ...f, emergencyContactName: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Emergency Contact Phone</label>
                    <input value={form.emergencyContactPhone} onChange={e => setForm(f => ({ ...f, emergencyContactPhone: e.target.value }))} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
                  <button type="submit" className="btn btn-primary">
                    {modal.mode === 'add' ? 'Register Patient' : 'Save Changes'}
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

function PatientView({ patient: p }: { patient: Patient }) {
  return (
    <div className="patient-view">
      <div className="pv-header">
        <div className="pv-avatar">{`${p.firstName[0]}${p.lastName[0]}`.toUpperCase()}</div>
        <div>
          <h3 className="pv-name">{p.firstName} {p.lastName}</h3>
          <p className="pv-id">{p.studentId ?? p.staffId ?? p.id}</p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <span className="badge badge-blue">{p.patientType}</span>
            <span className="badge badge-violet">{p.gender}</span>
            {p.bloodGroup && <span className="badge badge-red">{p.bloodGroup}</span>}
          </div>
        </div>
      </div>
      <div className="pv-grid">
        <PVItem label="Date of Birth" value={p.dateOfBirth} />
        <PVItem label="Phone" value={p.phone} />
        <PVItem label="Email" value={p.email} />
        <PVItem label="Department" value={p.department ?? '—'} />
        <PVItem label="Address" value={p.address} />
        <PVItem label="Registered" value={p.registeredAt} />
        <PVItem label="Allergies" value={p.allergies?.join(', ') || 'None'} />
        <PVItem label="Chronic Conditions" value={p.chronicConditions?.join(', ') || 'None'} />
        <PVItem label="Emergency Contact" value={`${p.emergencyContactName} – ${p.emergencyContactPhone}`} />
      </div>
    </div>
  );
}

function PVItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="pv-item">
      <div className="pv-label">{label}</div>
      <div className="pv-value">{value}</div>
    </div>
  );
}
