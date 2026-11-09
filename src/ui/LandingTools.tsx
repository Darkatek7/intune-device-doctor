import { Bookmark, ListChecks } from 'lucide-react';
import { forwardRef } from 'react';
import { de } from '../i18n/de';

interface Props {
  onOpenBulk: () => void;
  onOpenBookmarklet: () => void;
}

const BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-full bg-control px-3.5 py-1.5 text-sm font-medium text-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]';

/** Startseite: Einstieg in die Sammelprüfung (M12/B3) und das Lesezeichen (M12/B4). */
export const LandingTools = forwardRef<HTMLButtonElement, Props>(function LandingTools(
  { onOpenBulk, onOpenBookmarklet },
  bookmarkletRef,
) {
  return (
    <>
      <button type="button" onClick={onOpenBulk} title={de.bulk.openHint} className={BUTTON_CLASS}>
        <ListChecks aria-hidden="true" size={16} />
        {de.bulk.openButton}
      </button>
      <button
        ref={bookmarkletRef}
        type="button"
        onClick={onOpenBookmarklet}
        title={de.bookmarklet.openHint}
        className={BUTTON_CLASS}
      >
        <Bookmark aria-hidden="true" size={16} />
        {de.bookmarklet.openButton}
      </button>
    </>
  );
});
