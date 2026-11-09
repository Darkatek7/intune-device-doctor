import { Download, GitCompareArrows } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useRef, useState } from 'react';
import { downloadTextFile } from '../lib/download';
import { de } from '../i18n/de';
import {
  parseSnapshotFile,
  SNAPSHOT_MAX_CHARS,
  snapshotFileName,
  type SnapshotFile,
} from '../rules/snapshotCompare';
import { CompareDialog } from './CompareDialog';

interface Props {
  /** Aktueller Stand; null, solange nicht alle Kacheln ausgewertet sind */
  getCurrent: () => SnapshotFile | null;
  disabled?: boolean;
  /** Bezeichnung des aktuellen Stands im Vergleich */
  currentLabel: string;
}

const BUTTON_CLASS =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-control px-3.5 py-1.5 text-sm font-medium text-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60';

/**
 * „Stand exportieren“ und „Mit Stand vergleichen“ (M12/B1). Der Export ist ein reiner Download,
 * die Vergleichsdatei wird nur lokal gelesen. Nichts wird gespeichert oder gesendet.
 */
export function CompareControls({ getCurrent, disabled = false, currentLabel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const compareRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ before: SnapshotFile; fileName: string } | null>(null);
  const [current, setCurrent] = useState<SnapshotFile | null>(null);

  const exportSnapshot = () => {
    const snapshot = getCurrent();
    if (!snapshot) return;
    setError(null);
    downloadTextFile(
      snapshotFileName(snapshot),
      `${JSON.stringify(snapshot, null, 2)}\n`,
      'application/json',
    );
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const snapshot = getCurrent();
    if (!snapshot) return;
    // Eine Stand-Datei ist wenige KB groß; große Dateien gar nicht erst einlesen.
    if (file.size > SNAPSHOT_MAX_CHARS * 4) {
      setError(de.compare.errors.tooLarge);
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setError(de.compare.errors.readFailed);
      return;
    }
    const parsed = parseSnapshotFile(text);
    if (!parsed.ok) {
      setError(de.compare.errors[parsed.reason]);
      return;
    }
    setError(null);
    setCurrent(snapshot);
    setOpen({ before: parsed.snapshot, fileName: file.name });
  };

  const close = () => {
    setOpen(null);
    compareRef.current?.focus();
  };

  return (
    <div
      role="group"
      aria-label={de.compare.controlsLabel}
      className="flex flex-col gap-1.5 sm:items-end"
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={exportSnapshot}
          title={de.compare.exportHint}
          className={BUTTON_CLASS}
        >
          <Download aria-hidden="true" size={16} />
          {de.compare.exportButton}
        </button>
        <button
          ref={compareRef}
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          title={`${de.compare.compareHint} ${de.compare.fileLocal}`}
          className={BUTTON_CLASS}
        >
          <GitCompareArrows aria-hidden="true" size={16} />
          {de.compare.compareButton}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          hidden
          data-testid="compare-input"
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
      <p role="alert" className="text-sm text-critical empty:hidden">
        {error}
      </p>
      <AnimatePresence>
        {open && current && (
          <CompareDialog
            key="compare-dialog"
            before={open.before}
            after={current}
            beforeLabel={open.fileName}
            afterLabel={currentLabel}
            onClose={close}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
