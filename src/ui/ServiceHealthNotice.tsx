/**
 * Schmaler, ruhiger Hinweis oberhalb der Gerätekacheln (M18) – nur, wenn Microsoft aktuell einen
 * offenen Vorfall für Intune meldet. Der Titel ist Microsofts Originaltext (englisch, `lang="en"`).
 * Die Schaltfläche öffnet die Kachel „Dienststatus“ in der Ansicht „Mandant“. „Ausblenden“ verbirgt den
 * Hinweis für die Sitzung, bis Microsoft einen weiteren Vorfall meldet – die Kachel bleibt unverändert.
 */
import { CloudExclamationPoint } from 'lucide-react';
import { useNoticeDismissal, useServiceHealthNotice } from '../hooks/useServiceHealthNotice';
import { de } from '../i18n/de';
import type { DeviceDataProvider } from '../providers/DeviceDataProvider';

const n = de.service.health.notice;

interface Props {
  provider: DeviceDataProvider;
  onOpen: () => void;
}

export function ServiceHealthNotice({ provider, onOpen }: Props) {
  const incidents = useServiceHealthNotice(provider);
  const { dismissed, dismiss } = useNoticeDismissal(incidents);
  const first = incidents[0];
  if (!first || dismissed) return null;
  return (
    <aside
      aria-label={n.label}
      data-testid="service-health-notice"
      className="hc-edge flex flex-col gap-2 rounded-2xl material-card px-4 py-3 text-sm text-label sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex min-w-0 items-start gap-2">
        <CloudExclamationPoint
          aria-hidden="true"
          size={18}
          className="mt-0.5 shrink-0 text-warning"
        />
        <span className="min-w-0">
          {n.text}{' '}
          <span lang="en" className="font-medium">
            {first.title ?? first.id}
          </span>
          {incidents.length > 1 && <> {n.more(incidents.length - 1)}</>}
        </span>
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
        <button
          type="button"
          onClick={onOpen}
          className="rounded-full bg-fill px-3 py-1.5 text-sm font-medium text-accent outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
        >
          {n.open}
        </button>
        <button
          type="button"
          onClick={dismiss}
          title={n.dismissHint}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-secondary-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
        >
          {n.dismiss}
        </button>
      </div>
    </aside>
  );
}
