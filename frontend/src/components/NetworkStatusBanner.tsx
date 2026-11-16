import { CheckCircle2, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { useLanguage } from '../context/LanguageContext';
import './NetworkStatusBanner.css';

export default function NetworkStatusBanner() {
  const { online } = useNetwork();
  const { t } = useLanguage();
  const wasOffline = useRef(false);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setShowBackOnline(false);
      return;
    }

    if (wasOffline.current) {
      wasOffline.current = false;
      setShowBackOnline(true);
      const timeout = window.setTimeout(() => setShowBackOnline(false), 3500);
      return () => window.clearTimeout(timeout);
    }
  }, [online]);

  if (online && !showBackOnline) return null;

  return (
    <div className={`network-status-banner${online ? ' network-status-banner--online' : ''}`} role="status" aria-live="polite">
      {online ? <CheckCircle2 size={16} aria-hidden="true" /> : <WifiOff size={16} aria-hidden="true" />}
      <span>{online ? t('Back online') : t('Offline. Changes are paused until the connection returns.')}</span>
    </div>
  );
}
