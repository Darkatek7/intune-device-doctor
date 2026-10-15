import { CloudOff, Lock, RotateCw, SearchX, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { AppError, AppErrorCode } from '../domain/types';
import { de } from '../i18n/de';

const ICON: Partial<Record<AppErrorCode, LucideIcon>> = {
  forbidden: Lock,
  notFound: SearchX,
  network: CloudOff,
};

function titleFor(code: AppErrorCode): string {
  const titles = de.errorState.titles;
  switch (code) {
    case 'forbidden':
      return titles.forbidden;
    case 'notFound':
      return titles.notFound;
    case 'unauthenticated':
      return titles.unauthenticated;
    case 'throttled':
      return titles.throttled;
    case 'network':
      return titles.network;
    default:
      return titles.default;
  }
}

interface Props {
  error: AppError;
  onRetry?: () => void;
  title?: string;
}

/** Fehlerzustand für ein ganzes Gerät (getDevice/Suche fehlgeschlagen). */
export function ErrorState({ error, onRetry, title }: Props) {
  const Icon = ICON[error.code] ?? TriangleAlert;
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-3 hc-edge rounded-tile bg-surface p-8 text-center shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_16px_rgb(0_0_0/0.04)]"
    >
      <Icon aria-hidden="true" size={32} className="text-critical" />
      <h2 className="text-title font-semibold text-label">{title ?? titleFor(error.code)}</h2>
      <p className="text-base text-secondary-label">{error.message}</p>
      {error.requiredScope && (
        <p className="text-sm text-secondary-label">
          {de.errorState.requiredScope}:{' '}
          <code className="break-all font-mono text-xs">{error.requiredScope}</code>
        </p>
      )}
      {error.retryAfterSeconds ? (
        <p className="text-sm text-secondary-label">
          {de.states.retryAfter(error.retryAfterSeconds)}
        </p>
      ) : null}
      {error.requestId && (
        <p className="text-sm text-secondary-label">
          {de.errorState.requestId}:{' '}
          <code className="break-all font-mono text-xs">{error.requestId}</code>
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-accent-fill px-4 py-2 text-sm font-medium text-white outline-none transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent active:scale-[0.97]"
        >
          <RotateCw aria-hidden="true" size={16} />
          {de.errorState.retry}
        </button>
      )}
    </div>
  );
}
