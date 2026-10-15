import { ChevronRight, FileArchive } from 'lucide-react';
import { de } from '../i18n/de';
import { EXAMPLE_CHIP_CLASS } from './chipStyles';

interface Props {
  onClick: () => void;
  disabled?: boolean;
}

/** Chip für die Startseite (Demo): lädt die synthetische Beispiel-ZIP. Muss in einer <ul> stehen. */
export function ExampleZipChip({ onClick, disabled }: Props) {
  return (
    <li className="min-w-0">
      <button type="button" onClick={onClick} disabled={disabled} className={EXAMPLE_CHIP_CLASS}>
        <span aria-hidden="true" className="squircle size-8 bg-accent/15 text-accent">
          <FileArchive size={17} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-label">
            {de.zipView.exampleChip}
          </span>
          <span className="truncate text-xs text-secondary-label">
            {de.zipView.exampleChipHint}
          </span>
        </span>
        <ChevronRight aria-hidden="true" size={16} className="shrink-0 text-tertiary-label" />
      </button>
    </li>
  );
}
