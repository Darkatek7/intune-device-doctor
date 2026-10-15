import { Check, ChevronRight, Copy } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { de } from '../i18n/de';

type Evidence = Record<string, string | number | boolean | null>;

function show(value: string | number | boolean | null): string {
  return value === null ? '–' : String(value);
}

/** Einklappbare Key/Value-Tabelle der Rohdaten mit Kopieren-Button (Monospace für Werte). */
export function EvidenceTable({ evidence }: { evidence: Evidence }) {
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();
  const entries = Object.entries(evidence);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (entries.length === 0) return null;

  const onCopy = async () => {
    const text = entries.map(([k, v]) => `${k}: ${show(v)}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopy('idle'), 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="-ml-1 inline-flex items-center gap-1 rounded-lg px-1 py-0.5 text-sm font-medium text-label outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ChevronRight
            aria-hidden="true"
            size={16}
            className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          />
          {de.detail.evidence}
          <span className="sr-only">
            {' – '}
            {open ? de.sheet.hideEvidence : de.sheet.showEvidence}
          </span>
        </button>
        {open && (
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-sm text-accent outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
          >
            {copy === 'copied' ? (
              <Check aria-hidden="true" size={14} />
            ) : (
              <Copy aria-hidden="true" size={14} />
            )}
            {de.sheet.copy}
          </button>
        )}
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {copy === 'copied' ? de.sheet.copied : copy === 'failed' ? de.sheet.copyFailed : ''}
      </span>
      {open && (
        <dl
          id={panelId}
          className="mt-2 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-xl bg-canvas p-3 text-sm hc-edge"
        >
          {entries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="break-words text-secondary-label">{key}</dt>
              <dd className="break-all font-mono text-xs tabular-nums text-label">{show(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
