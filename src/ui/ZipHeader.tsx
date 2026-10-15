import { ChevronLeft } from 'lucide-react';
import { formatDateTime } from '../domain/format';
import type { DiagnosticsReport } from '../diagnostics/types';
import { de } from '../i18n/de';
import type { TileSummary } from '../rules/evaluate';
import { SeverityIcon } from './SeverityBadge';
import { summaryParts, summarySentence } from './summaryText';
import { zipTitle } from './zipTitle';

interface Props {
  report: DiagnosticsReport;
  summary: TileSummary;
  onBack: () => void;
}

/** Header der reinen ZIP-Ansicht – analog zum Geräte-Header. */
export function ZipHeader({ report, summary, onBack }: Props) {
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-semibold tracking-tight text-label sm:text-display">
            {title}
          </h1>
          <p className="mt-1 text-sm text-secondary-label">{kind}</p>
          <p className="break-all text-xs text-secondary-label">{report.fileName}</p>
        </div>
        <div
          aria-label={de.header.summaryLabel}
          className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-label sm:pb-1"
        >
          {summaryParts(summary).map((part) => (
            <span key={part.severity} className="inline-flex items-center gap-1.5">
              <SeverityIcon severity={part.severity} size={18} />
              {part.text}
            </span>
          ))}
        </div>
      </div>
      <p className="sr-only" aria-live="polite" role="status">
        {de.zipView.a11y.done(title, summarySentence(summary))}
      </p>
    </div>
  );
}
