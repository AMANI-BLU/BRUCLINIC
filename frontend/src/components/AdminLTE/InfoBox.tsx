import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightCircle } from 'lucide-react';

export type InfoBoxTone = 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger';

export interface InfoBoxProps {
  tone: InfoBoxTone;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail?: string;
  to?: string;
  onClick?: () => void;
  footerText?: string;
}

export default function InfoBox({
  tone,
  icon,
  label,
  value,
  detail,
  to,
  onClick,
  footerText = 'More info',
}: InfoBoxProps) {
  const navigate = useNavigate();

  const handleAction = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    }
  };

  const isClickable = Boolean(to || onClick);

  return (
    <div
      className={`small-box text-bg-${tone} clinic-metric-box h-100 ${isClickable ? 'is-clickable' : ''}`}
      onClick={isClickable ? handleAction : undefined}
      style={{ cursor: isClickable ? 'pointer' : 'default' }}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAction(); } } : undefined}
    >
      <div className="inner">
        <h3>{value}</h3>
        <p>{label}</p>
        {detail && <small>{detail}</small>}
      </div>
      <div className="icon" aria-hidden="true">{icon}</div>
      <div
        className="small-box-footer"
        onClick={(e) => {
          if (isClickable) {
            e.stopPropagation();
            handleAction();
          }
        }}
      >
        <span>{footerText}</span>
        <ArrowRightCircle size={14} className="small-box-footer-icon" />
      </div>
    </div>
  );
}
