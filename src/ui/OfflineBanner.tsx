import { WifiOff } from 'lucide-react';
import { de } from '../i18n/de';

/** Ruhiger Hinweis unter der Toolbar, solange der Browser offline ist (nur Live-Modus). */
export function OfflineBanner() {
  return (
    <div className="mx-auto max-w-[80rem] px-4 pt-4 sm:px-8">
      <p
        role="status"
        aria-live="polite"
        data-testid="offline-banner"
        className="hc-edge flex items-start gap-2 rounded-2xl bg-surface px-4 py-3 text-sm text-label shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
      >
        <WifiOff aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-warning" />
        {de.states.offline}
      </p>
    </div>
  );
}
