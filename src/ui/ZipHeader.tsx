import { ChevronLeft, FileArchive } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatDateTime } from '../domain/format';
import type { DiagnosticsReport } from '../diagnostics/types';
import { de } from '../i18n/de';
import type { TileSummary } from '../rules/evaluate';
import { summarySentence } from './summaryText';
import { SummaryPills } from './SummaryPills';
import { TONE_CLASS } from './tone';
import { zipTitle } from './zipTitle';

interface Props {
  report: DiagnosticsReport;
  summary: TileSummary;
  onBack: () => void;
  /** Aktionen rechts unter der Zusammenfassung, z. B. "Ticket-Notiz kopieren" */
  actions?: ReactNode;
}

/** Header der reinen ZIP-Ansicht – analog zum Geräte-Header. */
export function ZipHeader({ report, summary, onBack, actions }: Props) {
  const title = zipTitle(report);
  const kind = report.collectedAtUtc
    ? `${de.zipView.kind} · ${de.zipView.collectedAt(formatDateTime(report.collectedAtUtc))}`
    : de.zipView.kind;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 inline-flex items-center gap-0.5 rounded-full py-1 pr-2 pl-1 text-sm font-medium text-accent outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
        >
          <ChevronLeft aria-hidden="true" size={18} />
          {de.zipView.back}
        </button>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span
            aria-hidden="true"
            className={`squircle mt-1 size-14 shadow-[inset_0_1px_0_var(--c-highlight)] sm:size-16 ${TONE_CLASS[summary.worst]}`}
          >
            <FileArchive size={30} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h1 className="display-type break-words text-3xl font-semibold text-label sm:text-display">
              {title}
            </h1>
            <p className="mt-1.5 text-sm text-secondary-label">{kind}</p>
            <p className="break-all text-xs text-secondary-label">{report.fileName}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end sm:pb-1">
          <div
            aria-label={de.header.summaryLabel}
            className="flex flex-wrap items-center gap-2 text-sm font-medium text-label"
          >
            <SummaryPills summary={summary} />
          </div>
          {actions}
        </div>
      </div>
      <p className="sr-only" aria-live="polite" role="status">
        {de.zipView.a11y.done(title, summarySentence(summary))}
      </p>
    </div>
  );
}
