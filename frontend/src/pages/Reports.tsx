import { useClinic } from '../context/ClinicContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { TrendingUp, Users, Calendar, Activity } from 'lucide-react';

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'var(--font-heading)', color: 'var(--clr-primary-400)' }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)', marginTop: '0.25rem' }}>{label}</div>
    </div>
  );
}

export default function Reports() {
  const { patients, appointments, doctors, records } = useClinic();

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

  const monthlyVisits = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { month: date.toLocaleString('en', { month: 'short' }), visits: records.filter(record => record.visitDate?.startsWith(key)).length };
  });
  const diagnosisData = Object.entries(records.reduce<Record<string, number>>((counts, record) => {
    const diagnosis = record.diagnosis?.trim();
    if (diagnosis) counts[diagnosis] = (counts[diagnosis] || 0) + 1;
    return counts;
  }, {})).sort(([, a], [, b]) => b - a).slice(0, 6).map(([name, value]) => ({ name, value }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports &amp; Analytics</h1>
          <p className="page-subtitle">Clinic performance overview</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        <MetricCard label="Total Patients" value={patients.length} />
        <MetricCard label="Students" value={studentCount} />
        <MetricCard label="Staff" value={staffCount} />
        <MetricCard label="Total Appointments" value={appointments.length} />
        <MetricCard label="Completed" value={appointments.filter(a => a.status === 'Completed').length} />
        <MetricCard label="Doctors" value={doctors.length} />
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={18} className="text-primary" /> Monthly Visit Trend
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthlyVisits} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.07)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--clr-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--clr-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--clr-bg-card)', border: '1px solid var(--clr-border)', borderRadius: 10, color: 'var(--clr-text-primary)' }} />
              <Line type="monotone" dataKey="visits" stroke="var(--clr-primary-500)" strokeWidth={2.5} dot={{ fill: 'var(--clr-primary-500)', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={18} className="text-primary" /> Patient Types
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={patientTypeDist} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {patientTypeDist.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--clr-bg-card)', border: '1px solid var(--clr-border)', borderRadius: 10, color: 'var(--clr-text-primary)' }} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: 'var(--clr-text-secondary)', fontSize: 12 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} className="text-primary" /> Appointments by Type
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={apptByType} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.07)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--clr-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--clr-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--clr-bg-card)', border: '1px solid var(--clr-border)', borderRadius: 10, color: 'var(--clr-text-primary)' }} />
              <Bar dataKey="count" fill="var(--clr-primary-500)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} className="text-primary" /> Top Diagnoses
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={diagnosisData} layout="vertical" margin={{ top: 5, right: 10, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.07)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--clr-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'var(--clr-text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--clr-bg-card)', border: '1px solid var(--clr-border)', borderRadius: 10, color: 'var(--clr-text-primary)' }} />
              <Bar dataKey="value" fill="var(--clr-primary-500)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
