import { useClinic } from '../context/ClinicContext';
import { MONTHLY_VISITS, DIAGNOSIS_DISTRIBUTION } from '../data/mockData';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { TrendingUp, Users, Calendar, Activity } from 'lucide-react';

export default function Reports() {
  const { patients, appointments, doctors } = useClinic();

  const studentCount = patients.filter(p => p.patientType === 'Student').length;
  const staffCount   = patients.filter(p => p.patientType === 'Staff').length;
  const extCount     = patients.filter(p => p.patientType === 'External').length;

  const apptByType = ['General', 'Dental', 'Eye Care', 'Mental Health', 'Specialist', 'Emergency'].map(t => ({
    name: t, count: appointments.filter(a => a.type === t).length,
  }));

  const patientTypeDist = [
    { name: 'Students', value: studentCount, color: '#3b82f6' },
    { name: 'Staff',    value: staffCount,   color: '#10b981' },
    { name: 'External', value: extCount,     color: '#f59e0b' },
  ];

  const CARD = ({ label, value, color }: { label: string; value: string | number; color: string }) => (
    <div className="card" style={{ textAlign: 'center', borderColor: `${color}33` }}>
      <div style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'var(--font-heading)', color }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)', marginTop: '0.25rem' }}>{label}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Clinic performance overview</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        <CARD label="Total Patients" value={patients.length} color="#3b82f6" />
        <CARD label="Students" value={studentCount} color="#0ea5e9" />
        <CARD label="Staff" value={staffCount} color="#10b981" />
        <CARD label="Total Appointments" value={appointments.length} color="#8b5cf6" />
        <CARD label="Completed" value={appointments.filter(a => a.status === 'Completed').length} color="#10b981" />
        <CARD label="Doctors" value={doctors.length} color="#f59e0b" />
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={18} style={{ color: '#3b82f6' }} /> Monthly Visit Trend
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={MONTHLY_VISITS} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.07)" />
              <XAxis dataKey="month" tick={{ fill: '#4d6a94', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4d6a94', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#111e33', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, color: '#f0f6ff' }} />
              <Line type="monotone" dataKey="visits" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={18} style={{ color: '#10b981' }} /> Patient Types
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={patientTypeDist} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {patientTypeDist.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#111e33', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, color: '#f0f6ff' }} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: '#94afd4', fontSize: 12 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} style={{ color: '#8b5cf6' }} /> Appointments by Type
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={apptByType} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.07)" />
              <XAxis dataKey="name" tick={{ fill: '#4d6a94', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4d6a94', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#111e33', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, color: '#f0f6ff' }} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} style={{ color: '#f59e0b' }} /> Top Diagnoses
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={DIAGNOSIS_DISTRIBUTION} layout="vertical" margin={{ top: 5, right: 10, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.07)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#4d6a94', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94afd4', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#111e33', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, color: '#f0f6ff' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {DIAGNOSIS_DISTRIBUTION.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
