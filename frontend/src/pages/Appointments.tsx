import { useState } from 'react';
import { useClinic } from '../context/ClinicContext';
import type { Appointment, AppointmentStatus, AppointmentType, Priority } from '../types';
import { Plus, Search, X, Edit2, Trash2, CalendarDays, Clock } from 'lucide-react';


const PRIORITY_COLORS: Record<Priority, string> = {
  Low: 'badge-blue', Medium: 'badge-amber', High: 'badge-red', Critical: 'badge-red',
};

const EMPTY_APPT: Omit<Appointment, 'id'> = {
  patientId: '', patientName: '', doctorId: '', doctorName: '',
  date: '', time: '', type: 'General', status: 'Scheduled',
  reason: '', priority: 'Medium',
};

export default function Appointments() {
  const { appointments, patients, doctors, addAppointment, updateAppointment, deleteAppointment } = useClinic();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<AppointmentStatus | 'All'>('All');
  const [modal, setModal] = useState<{ open: boolean; appt?: Appointment }>({ open: false });
  const [form, setForm] = useState<Omit<Appointment, 'id'>>(EMPTY_APPT);

  const filtered = appointments.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = `${a.patientName} ${a.doctorName} ${a.type} ${a.reason}`.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'All' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const openAdd = () => { setForm(EMPTY_APPT); setModal({ open: true }); };
  const openEdit = (a: Appointment) => { setForm({ ...a }); setModal({ open: true, appt: a }); };
  const close = () => setModal({ open: false });

  const handlePatientChange = (id: string) => {
    const p = patients.find(x => x.id === id);
    setForm(f => ({ ...f, patientId: id, patientName: p ? `${p.firstName} ${p.lastName}` : '' }));
  };

  const handleDoctorChange = (id: string) => {
    const d = doctors.find(x => x.id === id);
    setForm(f => ({ ...f, doctorId: id, doctorName: d ? `${d.firstName} ${d.lastName}` : '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modal.appt) updateAppointment(modal.appt.id, form);
    else addAppointment(form);
    close();
  };

  const handleStatusChange = (id: string, status: AppointmentStatus) => {
    updateAppointment(id, { status });
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this appointment?')) deleteAppointment(id);
  };

  const counts = {
    All: appointments.length,
    Scheduled: appointments.filter(a => a.status === 'Scheduled').length,
    Completed: appointments.filter(a => a.status === 'Completed').length,
    Cancelled: appointments.filter(a => a.status === 'Cancelled').length,
    'No-Show': appointments.filter(a => a.status === 'No-Show').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Appointments</h1>
          <p className="page-subtitle">{appointments.length} total appointments</p>
        </div>
        <button className="btn btn-primary" id="add-appointment-btn" onClick={openAdd}>
          <Plus size={16} /> New Appointment
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar">
          <Search size={16} className="icon" />
          <input id="appt-search" placeholder="Search patient, doctor, type…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="pill-tabs">
          {(['All', 'Scheduled', 'Completed', 'Cancelled', 'No-Show'] as const).map(s => (
            <button key={s} className={`pill-tab ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
              {s} <span style={{ opacity: 0.7, fontSize: '0.72rem' }}>({counts[s]})</span>
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
              <th>Doctor</th>
              <th><CalendarDays size={14} style={{ verticalAlign: 'middle' }} /> Date & Time</th>
              <th>Type</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--clr-text-muted)' }}>No appointments found.</td></tr>
            ) : filtered.map(a => (
              <tr key={a.id}>
                <td>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{a.patientName}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>{a.reason}</div>
                </td>
                <td style={{ fontSize: '0.875rem' }}>{a.doctorName}</td>
                <td>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{a.date}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={12} /> {a.time}
                  </div>
                </td>
                <td><span className="badge badge-violet">{a.type}</span></td>
                <td><span className={`badge ${PRIORITY_COLORS[a.priority]}`}>{a.priority}</span></td>
                <td>
                  <select
                    value={a.status}
                    onChange={e => handleStatusChange(a.id, e.target.value as AppointmentStatus)}
                    className="status-select"
                    style={{ background: 'var(--clr-bg-hover)', border: '1px solid var(--clr-border)', borderRadius: 6, color: 'var(--clr-text-primary)', padding: '0.2rem 0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    {(['Scheduled', 'Completed', 'Cancelled', 'No-Show'] as AppointmentStatus[]).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <button className="btn btn-secondary btn-sm btn-icon" title="Edit" onClick={() => openEdit(a)}><Edit2 size={15} /></button>
                    <button className="btn btn-danger btn-sm btn-icon" title="Delete" onClick={() => handleDelete(a.id)}><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {modal.appt ? <><Edit2 size={18} className="text-primary" /> Edit Appointment</> : <><CalendarDays size={18} className="text-primary" /> New Appointment</>}
              </h2>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={close}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Patient *</label>
                  <select required value={form.patientId} onChange={e => handlePatientChange(e.target.value)}>
                    <option value="">Select patient…</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Doctor *</label>
                  <select required value={form.doctorId} onChange={e => handleDoctorChange(e.target.value)}>
                    <option value="">Select doctor…</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.firstName} {d.lastName} — {d.specialization}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input required type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Time *</label>
                  <input required type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as AppointmentType }))}>
                    {(['General','Dental','Eye Care','Mental Health','Specialist','Emergency'] as AppointmentType[]).map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}>
                    {(['Low','Medium','High','Critical'] as Priority[]).map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Reason for Visit *</label>
                  <input required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Brief description of the visit reason" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Notes</label>
                  <textarea rows={3} value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes…" style={{ resize: 'vertical' }} />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
                <button type="submit" className="btn btn-primary">{modal.appt ? 'Save Changes' : 'Book Appointment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
