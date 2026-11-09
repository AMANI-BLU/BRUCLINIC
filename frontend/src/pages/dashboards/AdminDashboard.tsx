/**
 * BruClinic — Admin Dashboard
 * Live KPI cards, charts, and departmental operational workload monitoring.
 */

import { useClinic } from '../../context/ClinicContext';
import {
  Activity, Building2, ChevronRight, CreditCard, FlaskConical,
  HeartPulse, Pill, Stethoscope, Users
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import './AdminDashboard.css';
import { diagnosisKey } from '../../utils/diagnosis';

type DepartmentTone = 'info' | 'success' | 'danger' | 'warning' | 'primary' | 'secondary';

export default function AdminDashboard() {
  const { patients, doctors, records, medicines, queue, erCases, labOrders, pharmacyOrders } = useClinic();

  const activeDocs = doctors.filter(d => d.available).length;
  const criticalER = erCases.filter(c => c.acuity === 'Red').length;
  const pendingRx = pharmacyOrders.filter(o => o.status === 'Pending').length;
  const pendingLab = labOrders.filter(o => o.status !== 'Completed').length;
  const lowStock = medicines.filter(m => m.stock <= m.minStock).length;

  const monthlyVisits = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { month: d.toLocaleString('en', { month: 'short' }), visits: records.filter(r => r.visitDate?.startsWith(key)).length };
  });

  const diagnosisCounts = records.reduce<Record<string, { name: string; value: number }>>((acc, record) => {
    const name = record.diagnosis?.trim().replace(/\s+/g, ' ');
    const key = name ? diagnosisKey(name) : '';
    if (name && key) {
      if (!acc[key]) acc[key] = { name, value: 0 };
      acc[key].value += 1;
    }
    return acc;
  }, {});
  const diagnosisData = Object.values(diagnosisCounts)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map(({ name, value }, i) => ({
      name,
      value,
      color: ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1'][i]
    }));

  const kpis = [
    { label: 'Patients', value: patients.length, detail: 'Database total', icon: Users, tone: 'info' },
    { label: 'Staff on Duty', value: `${activeDocs}/${doctors.length}`, detail: 'Coverage today', icon: Stethoscope, tone: 'success' },
    { label: 'Emergency Cases', value: erCases.length, detail: `${criticalER} red priority`, icon: HeartPulse, tone: 'danger' },
    { label: 'Prescriptions', value: pendingRx, detail: 'Pharmacy queue', icon: Pill, tone: 'warning' },
    { label: 'Lab Tests', value: pendingLab, detail: 'Open orders', icon: FlaskConical, tone: 'primary' },
    { label: 'Queue Tokens', value: queue.length, detail: 'Real-time tokens', icon: CreditCard, tone: 'secondary' },
  ] as const;

  const departments: Array<{
    name: string; status: string; metric: string; value: string | number;
    secondary: string; secondaryValue: string | number; icon: typeof Users; tone: DepartmentTone;
  }> = [
    { name: 'Reception & Cards', status: 'Normal', metric: 'Checked-in patients', value: queue.length, secondary: 'Registered cards', secondaryValue: patients.length, icon: CreditCard, tone: 'info' },
    { name: 'OPD & Triage', status: 'Active', metric: 'Doctor consultation', value: queue.filter(i => i.stage === 'Doctor Consultation').length, secondary: 'Nurse triage queue', secondaryValue: queue.filter(i => i.stage === 'Nurse Triage').length, icon: Stethoscope, tone: 'success' },
    { name: 'Emergency (ER)', status: criticalER > 0 ? 'High Acuity' : 'Normal', metric: 'Active cases', value: erCases.length, secondary: 'Red priority cases', secondaryValue: criticalER, icon: HeartPulse, tone: 'danger' },
    { name: 'Pharmacy', status: lowStock > 0 ? `${lowStock} low stock` : 'Stock OK', metric: 'Pending prescriptions', value: pendingRx, secondary: 'Tracked medicines', secondaryValue: medicines.length, icon: Pill, tone: 'warning' },
    { name: 'Laboratory', status: 'Active', metric: 'Diagnostic orders', value: labOrders.length, secondary: 'Pending verification', secondaryValue: pendingLab, icon: FlaskConical, tone: 'primary' },
    { name: 'Administration', status: 'Normal', metric: 'Medical professionals', value: doctors.length, secondary: 'On-duty doctors', secondaryValue: activeDocs, icon: Building2, tone: 'secondary' },
  ];

  return (
    <div className="admin-dashboard">
      <div className="content-header admin-content-header py-1 mb-3">
        <div className="container-fluid px-0">
          <h1 className="m-0" style={{ fontSize: '1.35rem', fontWeight: 700 }}>Clinic Administration Dashboard</h1>
          <p className="admin-page-subtitle mb-0" style={{ fontSize: '0.85rem' }}>Executive KPI metrics, patient volume trends, and departmental oversight</p>
        </div>
      </div>

      <div className="adm-dashboard-body">
        <section aria-label="Executive key performance indicators" className="adm-dashboard-section">
          <div className="row g-3 admin-kpi-grid">
            {kpis.map(({ label, value, detail, icon: Icon, tone }) => (
              <div className="col-xl-2 col-lg-4 col-md-6" key={label}>
                <div className={`small-box text-bg-${tone} admin-kpi-box`}>
                  <div className="inner"><h3>{value}</h3><p>{label}</p><small>{detail}</small></div>
                  <div className="icon"><Icon aria-hidden="true" /></div>
                  <div className="small-box-footer admin-kpi-footer"><span>Live metrics</span><ChevronRight aria-hidden="true" /></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="adm-dashboard-section" aria-label="Clinical analytics">
          <div className="row g-4 admin-analytics-row">
            <div className="col-lg-8">
              <div className="card card-outline card-primary admin-card admin-chart-card">
                <div className="card-header">
                  <h3 className="card-title"><Activity size={19} /> Patient Volume &amp; Departmental Visits</h3>
                  <span className="admin-card-period">2026 Academic Year</span>
                </div>
                <div className="card-body">
                  <div className="admin-chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyVisits} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                        <defs>
                          <linearGradient id="adminVisitsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#007bff" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#007bff" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(108,117,125,0.16)" />
                        <XAxis dataKey="month" tick={{ fill: '#6c757d', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#6c757d', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: '#343a40', border: 0, borderRadius: 4, color: '#fff' }} />
                        <Area type="monotone" dataKey="visits" stroke="#007bff" strokeWidth={3} fill="url(#adminVisitsGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="card card-outline card-info admin-card admin-mix-card">
                <div className="card-header"><h3 className="card-title"><Activity size={19} /> Case Category Mix</h3></div>
                <div className="card-body">
                  <div className="admin-donut-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={diagnosisData} cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3} dataKey="value">
                          {diagnosisData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#343a40', border: 0, borderRadius: 4, color: '#fff' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="admin-mix-legend">
                    {diagnosisData.slice(0, 4).map(e => <div key={e.name}><span style={{ backgroundColor: e.color }} />{e.name}<strong>{e.value}</strong></div>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="card card-outline card-secondary admin-card admin-departments-card adm-dashboard-section" aria-label="Active departmental workloads">
          <div className="card-header">
            <h3 className="card-title"><Building2 size={19} /> Active Departmental Workloads</h3>
            <span className="admin-card-period">Live operational snapshot</span>
          </div>
          <div className="card-body">
            <div className="row g-3 admin-departments-grid">
              {departments.map(({ name, status, metric, value, secondary, secondaryValue, icon: Icon, tone }) => (
                <div className="col-xl-4 col-md-6" key={name}>
                  <div className={`info-box admin-department-box admin-department-${tone}`}>
                    <span className={`info-box-icon bg-${tone}`}><Icon aria-hidden="true" /></span>
                    <div className="info-box-content">
                      <span className="info-box-text">{name}</span>
                      <span className="admin-department-status">{status}</span>
                      <span className="admin-department-metric">{metric} <strong>{value}</strong></span>
                      <span className="admin-department-metric">{secondary} <strong>{secondaryValue}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
