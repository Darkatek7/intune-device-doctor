import { de } from '../i18n/de';

interface Props {
  onClick: () => void;
  disabled?: boolean;
}

/** Chip für die Startseite (Demo): lädt die synthetische Beispiel-ZIP. Muss in einer <ul> stehen. */
export function ExampleZipChip({ onClick, disabled }: Props) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex flex-col items-start rounded-2xl bg-surface px-4 py-2 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-separator outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="text-sm font-semibold text-label">{de.zipView.exampleChip}</span>
        <span className="text-xs text-secondary-label">{de.zipView.exampleChipHint}</span>
      </button>
    </li>
  );
}
