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
    <div className={`small-box text-bg-${tone} clinic-metric-box h-100`}>
      <div className="inner">
        <h3>{value}</h3>
        <p>{label}</p>
        {detail && <small>{detail}</small>}
      </div>
      <div className="icon" aria-hidden="true">{icon}</div>
    </div>
  );
}
