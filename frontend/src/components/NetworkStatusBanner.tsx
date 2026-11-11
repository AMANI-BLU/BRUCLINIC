import { WifiOff } from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import './NetworkStatusBanner.css';

export default function NetworkStatusBanner() {
  const { online } = useNetwork();

  if (online) return null;

  return (
    <div className="network-status-banner" role="status" aria-live="polite">
      <WifiOff size={16} aria-hidden="true" />
      <span>Offline. Changes are paused until the connection returns.</span>
    </div>
  );
}
