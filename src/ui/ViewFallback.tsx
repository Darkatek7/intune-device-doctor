import { de } from '../i18n/de';

/**
 * Platzhalter, solange eine nachgeladene Ansicht kommt. Er blendet erst nach kurzer Verzögerung ein
 * (`fade-in-delayed`) – bei schnellem Laden erscheint nichts, es gibt kein Aufblitzen. Form: Kopfzeile
 * und Kacheln als ruhige Flächen.
 */
export function ViewFallback() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-testid="view-fallback"
      className="fade-in-delayed flex flex-col gap-6"
    >
      <span className="sr-only">{de.states.loading}</span>
      <div aria-hidden="true" className="flex items-center gap-4">
        <div className="skeleton size-14 rounded-[28%] sm:size-16" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="skeleton h-8 w-2/3 max-w-sm rounded-md" />
          <div className="skeleton h-4 w-1/2 max-w-xs rounded-md" />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-28 rounded-tile" />
        ))}
      </div>
    </div>
  );
}
