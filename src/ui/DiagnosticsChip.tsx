import { X } from 'lucide-react';
import { de } from '../i18n/de';

interface Props {
  fileName: string;
  onRemove: () => void;
}

/** Zeigt, dass Befunde einer DiagLogs-ZIP in der Ansicht enthalten sind – mit Entfernen-Möglichkeit. */
export function DiagnosticsChip({ fileName, onRemove }: Props) {
  return (
    <span
      title={de.zipView.chip.title(fileName)}
      className="inline-flex items-center gap-1 rounded-full bg-accent/12 py-0.5 pr-0.5 pl-3 text-sm font-medium text-label"
    >
      {de.zipView.chip.label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={de.zipView.chip.remove}
        className="inline-flex size-6 items-center justify-center rounded-full outline-none transition-transform hover:bg-accent/12 focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.92]"
      >
        <X aria-hidden="true" size={14} />
      </button>
    </span>
  );
}
