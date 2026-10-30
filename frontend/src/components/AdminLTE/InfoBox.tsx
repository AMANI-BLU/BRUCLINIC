import type { ReactNode } from 'react';

type InfoBoxTone = 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger';

export default function InfoBox({ tone, icon, label, value, detail }: {
  tone: InfoBoxTone;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div className="info-box shadow-sm h-100">
      <span className={`info-box-icon bg-${tone}`}>{icon}</span>
      <div className="info-box-content">
        <span className="info-box-text">{label}</span>
        <span className="info-box-number">{value}</span>
        {detail && <span className="progress-description">{detail}</span>}
      </div>
    </div>
  );
}
