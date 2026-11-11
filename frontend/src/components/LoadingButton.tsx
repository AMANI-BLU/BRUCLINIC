import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingLabel?: ReactNode;
  children: ReactNode;
}

/** A submit/action button that prevents repeat clicks while its request runs. */
export default function LoadingButton({
  loading = false,
  loadingLabel = 'Please wait…',
  disabled,
  children,
  ...props
}: LoadingButtonProps) {
  return (
    <button
      {...props}
      disabled={Boolean(disabled || loading)}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <>
          <Loader2 size={15} className="btn-loading-spinner" aria-hidden="true" />
          <span>{loadingLabel}</span>
        </>
      ) : children}
    </button>
  );
}
