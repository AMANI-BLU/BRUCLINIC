import { useClinic } from '../../context/ClinicContext';
import {
  Activity,
  Building2,
  ChevronRight,
  CreditCard,
  FlaskConical,
  HeartPulse,
  Pill,
  Stethoscope,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './AdminDashboard.css';

type DepartmentTone = 'info' | 'success' | 'danger' | 'warning' | 'primary' | 'secondary';

export default function AdminDashboard() {
  const { patients, doctors, records, medicines, queue, erCases, labOrders, pharmacyOrders } = useClinic();

  const activeDocs = doctors.filter((doctor) => doctor.available).length;
  const criticalER = erCases.filter((caseItem) => caseItem.acuity === 'Red').length;
  const pendingRx = pharmacyOrders.filter((order) => order.status === 'Pending').length;
  const pendingLab = labOrders.filter((order) => order.status !== 'Completed').length;
  const lowStock = medicines.filter((medicine) => medicine.stock <= medicine.minStock).length;

  const monthlyVisits = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    const month = date.toLocaleString('en', { month: 'short' });
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { month, visits: records.filter(record => record.visitDate?.startsWith(key)).length };
  });
  const diagnosisCounts = records.reduce<Record<string, number>>((counts, record) => {
    const diagnosis = record.diagnosis?.trim();
    if (diagnosis) counts[diagnosis] = (counts[diagnosis] || 0) + 1;
    return counts;
  }, {});
  const diagnosisData = Object.entries(diagnosisCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, value], index) => ({ name, value, color: ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1'][index] }));

  const kpis = [
    { label: 'Patients', value: patients.length, detail: 'Database total', icon: Users, tone: 'info' },
    { label: 'Staff on Duty', value: `${activeDocs}/${doctors.length}`, detail: 'Coverage today', icon: Stethoscope, tone: 'success' },
    { label: 'Emergency Cases', value: erCases.length, detail: `${criticalER} red priority`, icon: HeartPulse, tone: 'danger' },
    { label: 'Prescriptions', value: pendingRx, detail: 'Pharmacy queue', icon: Pill, tone: 'warning' },
    { label: 'Lab Tests', value: pendingLab, detail: 'Open orders', icon: FlaskConical, tone: 'primary' },
    { label: 'Queue Tokens', value: queue.length, detail: 'Real-time tokens', icon: CreditCard, tone: 'secondary' },
  ] as const;

  const departments: Array<{
    name: string;
    status: string;
    metric: string;
    value: string | number;
    secondary: string;
    secondaryValue: string | number;
    icon: typeof Users;
    tone: DepartmentTone;
  }> = [
    {
      name: 'Reception & Cards', status: 'Normal', metric: 'Checked-in patients', value: queue.length,
      secondary: 'Registered cards', secondaryValue: patients.length, icon: CreditCard, tone: 'info',
    },
    {
      name: 'OPD & Triage', status: 'Active', metric: 'Doctor consultation',
      value: queue.filter((item) => item.stage === 'Doctor Consultation').length,
      secondary: 'Nurse triage queue', secondaryValue: queue.filter((item) => item.stage === 'Nurse Triage').length,
      icon: Stethoscope, tone: 'success',
    },
    {
      name: 'Emergency (ER)', status: criticalER > 0 ? 'High Acuity' : 'Normal', metric: 'Active cases',
      value: erCases.length, secondary: 'Red priority cases', secondaryValue: criticalER,
      icon: HeartPulse, tone: 'danger',
    },
    {
      name: 'Pharmacy', status: lowStock > 0 ? `${lowStock} low stock` : 'Stock OK',
      metric: 'Pending prescriptions', value: pendingRx, secondary: 'Tracked medicines', secondaryValue: medicines.length,
      icon: Pill, tone: 'warning',
    },
    {
      name: 'Laboratory', status: 'Active', metric: 'Diagnostic orders', value: labOrders.length,
      secondary: 'Pending verification', secondaryValue: pendingLab, icon: FlaskConical, tone: 'primary',
    },
    {
      name: 'Administration', status: 'Normal', metric: 'Medical professionals', value: doctors.length,
      secondary: 'On-duty doctors', secondaryValue: activeDocs, icon: Building2, tone: 'secondary',
    },
  ];

  return (
    <div className="admin-dashboard">
      <div className="content-header admin-content-header py-1 mb-2">
        <div className="container-fluid px-0">
          <h1 className="m-0" style={{ fontSize: '1.25rem', fontWeight: 700 }}>Executive Overview</h1>
          <p className="admin-page-subtitle mb-0" style={{ fontSize: '0.8rem' }}>Clinic operations and unit status</p>
        </div>
      </div>

      <section aria-label="Executive key performance indicators">
        <div className="row admin-kpi-grid">
          {kpis.map(({ label, value, detail, icon: Icon, tone }) => (
            <div className="col-xl-2 col-lg-4 col-md-6" key={label}>
              <div className={`small-box bg-${tone} admin-kpi-box`}>
                <div className="inner">
                  <h3>{value}</h3>
                  <p>{label}</p>
                  <small>{detail}</small>
                </div>
                <div className="icon"><Icon aria-hidden="true" /></div>
                <div className="small-box-footer admin-kpi-footer">
                  <span>View details</span><ChevronRight aria-hidden="true" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="row admin-analytics-row" aria-label="Clinical analytics">
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
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(108, 117, 125, 0.16)" />
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
            <div className="card-header">
              <h3 className="card-title"><Activity size={19} /> Case Category Mix</h3>
            </div>
            <div className="card-body">
              <div className="admin-donut-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={diagnosisData} cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3} dataKey="value">
                      {diagnosisData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#343a40', border: 0, borderRadius: 4, color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="admin-mix-legend">
                {diagnosisData.slice(0, 4).map((entry) => (
                  <div key={entry.name}><span style={{ backgroundColor: entry.color }} />{entry.name}<strong>{entry.value}</strong></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card card-outline card-secondary admin-card admin-departments-card" aria-label="Active departmental workloads">
        <div className="card-header">
          <h3 className="card-title"><Building2 size={19} /> Active Departmental Workloads</h3>
          <span className="admin-card-period">Live operational snapshot</span>
        </div>
        <div className="card-body">
          <div className="row">
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
  );
}
