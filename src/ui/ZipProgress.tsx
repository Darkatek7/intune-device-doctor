import { FileArchive } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { AnalysisProgress } from '../diagnostics/analyze';
import { de } from '../i18n/de';
import { spring } from './motion';

interface Props {
  fileName: string;
  progress?: AnalysisProgress | undefined;
  onCancel: () => void;
}

/** Fortschrittsansicht während der lokalen ZIP-Analyse. */
export function ZipProgress({ fileName, progress, onCancel }: Props) {
  const reduced = useReducedMotion();
  const ratio =
    progress && progress.total > 0
      ? Math.min(1, Math.max(0, progress.completed / progress.total))
      : 0;
  const percent = Math.round(ratio * 100);

  return (
    <section
      aria-labelledby="zip-progress-title"
      className="mx-auto flex max-w-xl flex-col gap-5 material-card hc-edge rounded-tile p-6 sm:p-8"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="squircle size-12 bg-accent/15 text-accent">
          <FileArchive size={24} strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h1 id="zip-progress-title" className="text-title font-semibold text-label">
            {de.zipView.progress.title}
          </h1>
          <p className="mt-0.5 break-all text-sm text-secondary-label">{fileName}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div
          role="progressbar"
          aria-label={de.zipView.progress.barLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress ? percent : undefined}
          className="h-1.5 overflow-hidden rounded-full bg-fill"
        >
          <motion.div
            className="h-full origin-left rounded-full bg-accent-fill"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: ratio }}
            transition={reduced ? { duration: 0 } : spring}
          />
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <p aria-live="polite" className="min-w-0 text-label">
            {progress?.message ?? de.zipView.progress.starting}
          </p>
          {progress && (
            <p className="shrink-0 text-secondary-label tabular-nums">
              {de.zipView.progress.step(progress.completed, progress.total)}
            </p>
          )}
        </div>
      </div>

      <p className="text-sm text-secondary-label">{de.dropZone.privacy}</p>

      <div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full bg-control px-4 py-1.5 text-sm font-medium text-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
        >
          {de.zipView.progress.cancel}
        </button>
      </div>
    </section>
  );
}
