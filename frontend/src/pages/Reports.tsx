import { useClinic } from '../context/ClinicContext';
import InfoBox from '../components/AdminLTE/InfoBox';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Activity, CalendarDays, Download, Stethoscope, Users } from 'lucide-react';
import { diagnosisKey } from '../utils/diagnosis';
import './Reports.css';

const appointmentTypes = ['General', 'Dental', 'Eye Care', 'Mental Health', 'Specialist', 'Emergency'];
const appointmentColors = ['#0d6efd', '#20c997', '#fd7e14', '#6f42c1', '#17a2b8', '#dc3545'];
const patientColors = ['#0d6efd', '#20c997', '#ffc107'];

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export default function Reports() {
  const { patients, appointments, doctors, records } = useClinic();
  const studentCount = patients.filter(patient => patient.patientType === 'Student').length;
  const staffCount = patients.filter(patient => patient.patientType === 'Staff').length;
  const externalCount = patients.filter(patient => patient.patientType === 'External').length;
  const completedAppointments = appointments.filter(appointment => appointment.status === 'Completed').length;

  const appointmentsByType = appointmentTypes.map(name => ({
    name,
    count: appointments.filter(appointment => appointment.type === name).length,
  }));
  const patientTypeData = [
    { name: 'Students', value: studentCount, color: patientColors[0] },
    { name: 'Staff', value: staffCount, color: patientColors[1] },
    { name: 'External', value: externalCount, color: patientColors[2] },
  ];
  const monthlyVisits = Array.from({ length: 12 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (11 - index));
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return {
      month: date.toLocaleString('en', { month: 'short' }),
      period,
      visits: records.filter(record => record.visitDate?.startsWith(period)).length,
    };
  });
  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
  const bloodGroupColors = ['#dc3545', '#e63946', '#0d6efd', '#0dcaf0', '#6f42c1', '#d63384', '#198754', '#20c997'];
  const bloodGroupData = bloodGroups.map((bg, index) => ({
    name: bg,
    count: patients.filter(patient => patient.bloodGroup === bg).length,
    color: bloodGroupColors[index % bloodGroupColors.length],
  }));
  const totalWithBloodGroup = patients.filter(patient => Boolean(patient.bloodGroup)).length;

  const diagnosisData = Object.values(records.reduce<Record<string, { name: string; value: number }>>((counts, record) => {
    const name = record.diagnosis?.trim().replace(/\s+/g, ' ');
    const key = name ? diagnosisKey(name) : '';
    if (name && key) {
      if (!counts[key]) counts[key] = { name, value: 0 };
      counts[key].value += 1;
    }
    return counts;
  }, {})).sort((left, right) => right.value - left.value).slice(0, 8);

  const handleDownload = () => {
    const rows: Array<Array<string | number>> = [
      ['BruClinic Reports & Analytics'],
      ['Generated', new Date().toISOString()],
      [],
      ['Summary', 'Value'],
      ['Total patients', patients.length],
      ['Student patients', studentCount],
      ['Staff patients', staffCount],
      ['External patients', externalCount],
      ['Total appointments', appointments.length],
      ['Completed appointments', completedAppointments],
      ['Doctors', doctors.length],
      [],
      ['Monthly visits', 'Visits'],
      ...monthlyVisits.map(item => [item.period, item.visits]),
      [],
      ['Appointments by type', 'Count'],
      ...appointmentsByType.map(item => [item.name, item.count]),
      [],
      ['Top diagnoses', 'Records'],
      ...diagnosisData.map(item => [item.name, item.value]),
      [],
      ['Patient Blood Types', 'Count'],
      ...bloodGroupData.map(item => [item.name, item.count]),
    ];
    const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `bruclinic-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const tooltipStyle = {
    background: 'var(--clr-bg-card)',
    border: '1px solid var(--clr-border)',
    borderRadius: 4,
    color: 'var(--clr-text-primary)',
  };

  return (
    <div className="reports-page">
      <div className="page-header reports-header">
        <div>
          <h1 className="page-title">Reports &amp; Analytics</h1>
          <p className="page-subtitle">Clinic activity, patient mix, and common diagnoses</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleDownload}>
          <Download size={16} /> Download CSV
        </button>
      </div>

      <section className="row report-kpis" aria-label="Clinic summary">
        <div className="col-6 col-lg-4 col-xxl-2"><InfoBox tone="info" icon={<Users size={22} />} value={patients.length} label="Total Patients" /></div>
        <div className="col-6 col-lg-4 col-xxl-2"><InfoBox tone="success" icon={<Users size={22} />} value={studentCount} label="Students" /></div>
        <div className="col-6 col-lg-4 col-xxl-2"><InfoBox tone="warning" icon={<Users size={22} />} value={staffCount} label="Staff" /></div>
        <div className="col-6 col-lg-4 col-xxl-2"><InfoBox tone="primary" icon={<CalendarDays size={22} />} value={appointments.length} label="Appointments" /></div>
        <div className="col-6 col-lg-4 col-xxl-2"><InfoBox tone="success" icon={<Activity size={22} />} value={completedAppointments} label="Completed" /></div>
        <div className="col-6 col-lg-4 col-xxl-2"><InfoBox tone="secondary" icon={<Stethoscope size={22} />} value={doctors.length} label="Doctors" /></div>
      </section>

      <section className="row report-charts" aria-label="Clinic analytics">
        <div className="col-12 col-xl-8">
          <article className="card card-outline card-primary report-chart-card">
            <header className="card-header">
              <h2 className="card-title"><Activity size={17} /> Monthly visits</h2>
              <span className="report-chart-caption">Last 12 months</span>
            </header>
            <div className="card-body">
              <div className="report-chart report-chart-wide">
                {records.length === 0 ? <div className="report-empty">No visit records available yet.</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyVisits} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="reportVisitFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0d6efd" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="#0d6efd" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="var(--clr-border)" strokeDasharray="3 4" />
                      <XAxis dataKey="month" tick={{ fill: 'var(--clr-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: 'var(--clr-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="visits" name="Visits" stroke="#0d6efd" strokeWidth={3} fill="url(#reportVisitFill)" activeDot={{ r: 5, strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </article>
        </div>

        <div className="col-12 col-xl-4">
          <article className="card card-outline card-info report-chart-card">
            <header className="card-header">
              <h2 className="card-title"><Users size={17} /> Patient types</h2>
              <span className="report-chart-caption">{patients.length} registered</span>
            </header>
            <div className="card-body">
              <div className="report-chart report-chart-donut">
                {patients.length === 0 ? <div className="report-empty">No patient profiles available yet.</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={patientTypeData} cx="50%" cy="50%" innerRadius="54%" outerRadius="78%" paddingAngle={3} dataKey="value" stroke="var(--clr-bg-card)" strokeWidth={3}>
                        {patientTypeData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend verticalAlign="bottom" iconType="circle" iconSize={8} formatter={value => <span className="report-legend-label">{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </article>
        </div>

        <div className="col-12 col-xl-6">
          <article className="card card-outline card-warning report-chart-card">
            <header className="card-header">
              <h2 className="card-title"><CalendarDays size={17} /> Appointments by type</h2>
              <span className="report-chart-caption">{appointments.length} total</span>
            </header>
            <div className="card-body">
              <div className="report-chart report-chart-bars">
                {appointments.length === 0 ? <div className="report-empty">No appointments available yet.</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={appointmentsByType} margin={{ top: 6, right: 14, left: 4, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--clr-border)" strokeDasharray="3 4" />
                      <XAxis dataKey="name" tick={{ fill: 'var(--clr-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                      <YAxis allowDecimals={false} tick={{ fill: 'var(--clr-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" name="Appointments" radius={[4, 4, 0, 0]} maxBarSize={42}>
                        {appointmentsByType.map((item, index) => <Cell key={item.name} fill={appointmentColors[index % appointmentColors.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </article>
        </div>

        <div className="col-12 col-xl-6">
          <article className="card card-outline card-success report-chart-card">
            <header className="card-header">
              <h2 className="card-title"><Stethoscope size={17} /> Most recorded diagnoses</h2>
              <span className="report-chart-caption">Top {diagnosisData.length}</span>
            </header>
            <div className="card-body">
              <div className="report-chart report-chart-diagnoses" style={{ height: Math.max(220, diagnosisData.length * 38) }}>
                {diagnosisData.length === 0 ? <div className="report-empty">No diagnoses recorded yet.</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={diagnosisData} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
                      <CartesianGrid horizontal={false} stroke="var(--clr-border)" strokeDasharray="3 4" />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--clr-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fill: 'var(--clr-text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" name="Visits" fill="#20a779" radius={[0, 4, 4, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </article>
        </div>
        <div className="col-12 col-xl-6">
          <article className="card card-outline card-danger report-chart-card">
            <header className="card-header">
              <h2 className="card-title"><Activity size={17} /> Patient blood types</h2>
              <span className="report-chart-caption">{totalWithBloodGroup} patients with recorded ABO/Rh</span>
            </header>
            <div className="card-body">
              <div className="report-chart report-chart-bars">
                {totalWithBloodGroup === 0 ? <div className="report-empty">No patient blood types recorded yet.</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bloodGroupData} margin={{ top: 6, right: 14, left: 4, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--clr-border)" strokeDasharray="3 4" />
                      <XAxis dataKey="name" tick={{ fill: 'var(--clr-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: 'var(--clr-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" name="Patients" radius={[4, 4, 0, 0]} maxBarSize={36}>
                        {bloodGroupData.map(item => <Cell key={item.name} fill={item.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
