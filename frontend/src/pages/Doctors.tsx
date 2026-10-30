import { useClinic } from '../context/ClinicContext';
import {
  Stethoscope, Mail, Phone, Calendar, CheckCircle2, XCircle,
  Brain, Eye, Sparkles, HeartPulse
} from 'lucide-react';


const SPEC_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; className?: string }>> = {
  'General Practice': Stethoscope,
  'Gynecology': HeartPulse,
  'Dental': Sparkles,
  'Mental Health': Brain,
  'Ophthalmology': Eye,
};

export default function Doctors() {
  const { doctors, appointments } = useClinic();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img
            src="/bu-logo.png"
            alt="Borana University"
            style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid rgba(220,38,38,0.4)', objectFit: 'cover', boxShadow: '0 0 16px rgba(220,38,38,0.2)' }}
          />
          <div>
            <h1 className="page-title">Medical Staff</h1>
            <p className="page-subtitle">{doctors.length} doctors &amp; clinical specialists</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {doctors.map(d => {
          const SpecIcon = SPEC_ICONS[d.specialization] ?? Stethoscope;
          const apptCount = appointments.filter(a => a.doctorId === d.id).length;
          const completedCount = appointments.filter(a => a.doctorId === d.id && a.status === 'Completed').length;

          return (
            <div key={d.id} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
              {/* Decorative bg circle */}
              <div style={{
                position: 'absolute', top: -20, right: -20,
                width: 100, height: 100, borderRadius: '50%',
                background: 'var(--clr-primary-500)', opacity: 0.06,
              }} />

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'var(--clr-primary-500)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)',
                }}>
                  <SpecIcon size={24} color="#ffffff" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-heading)' }}>
                    {d.firstName} {d.lastName}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-secondary)', marginTop: '0.2rem' }}>
                    {d.specialization}
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    {d.available ? (
                      <span className="badge badge-blue"><CheckCircle2 size={10} /> Available</span>
                    ) : (
                      <span className="badge badge-red"><XCircle size={10} /> Unavailable</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="divider" />

              {/* Contact */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '0.875rem 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--clr-text-secondary)' }}>
                  <Mail size={13} /> {d.email}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--clr-text-secondary)' }}>
                  <Phone size={13} /> {d.phone}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--clr-text-secondary)' }}>
                  <Calendar size={13} /> {d.schedule.join(', ')}
                </div>
              </div>

              <div className="divider" />

              {/* Stats */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.875rem' }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--clr-primary-400)' }}>
                    {apptCount}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>Total Appts</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--clr-primary-400)' }}>
                    {completedCount}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>Completed</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--clr-text-primary)' }}>
                    {d.gender[0]}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>Gender</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
