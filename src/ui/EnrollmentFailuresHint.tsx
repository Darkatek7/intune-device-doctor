/**
 * Dezenter Verweis bei einer Suche ohne Treffer (M18): Scheitert schon die Registrierung, gibt es kein
 * Intune-Gerät – die Registrierungsfehler stehen dann nur im Mandanten.
 */
import { de } from '../i18n/de';

const h = de.service.failures.searchHint;

export function EnrollmentFailuresHint({ onOpen }: { onOpen: () => void }) {
  return (
    <p className="text-sm text-secondary-label">
      {h.text}{' '}
      <button
        type="button"
        onClick={onOpen}
        className="rounded font-medium text-accent underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
      >
        {h.link}
      </button>
    </p>
  );
}
