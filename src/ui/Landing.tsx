import type { ReactNode } from 'react';
import { de } from '../i18n/de';
import type { ExampleDevice } from '../hooks/useExampleDevices';
import { DropZone } from './DropZone';

interface Props {
  /** Großes Suchfeld */
  search: ReactNode;
  /** Demo-Modus: Beispielgeräte als Chips (ein Klick lädt das Szenario); leer = keine Chips */
  examples: ExampleDevice[];
  onPickExample: (deviceName: string) => void;
  /** Platz für weitere Chips, z. B. "Beispiel-ZIP analysieren" (M5) */
  extraChips?: ReactNode;
  onFile?: (file: File) => void;
}

/** Leerer Zustand: großes Suchfeld, Beispiel-Chips, Drop-Zone. */
export function Landing({ search, examples, onPickExample, extraChips, onFile }: Props) {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center gap-8 py-10 sm:py-20">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-label sm:text-display">
          {de.hero.title}
        </h1>
        <p className="mt-3 text-base text-secondary-label">{de.hero.subtitle}</p>
      </div>
      {search}
      {(examples.length > 0 || extraChips) && (
        <div className="w-full">
          <h2 className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-secondary-label">
            {de.demo.examplesTitle}
          </h2>
          <ul className="flex flex-wrap justify-center gap-2">
            {examples.map((scenario) => (
              <li key={scenario.deviceName}>
                <button
                  type="button"
                  onClick={() => onPickExample(scenario.deviceName)}
                  className="flex flex-col items-start rounded-2xl bg-surface px-4 py-2 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-separator outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
                >
                  <span className="text-sm font-semibold text-label">{scenario.deviceName}</span>
                  <span className="text-xs text-secondary-label">{scenario.label}</span>
                </button>
              </li>
            ))}
            {extraChips}
          </ul>
        </div>
      )}
      <div className="w-full">
        <DropZone onFile={onFile} />
      </div>
    </section>
  );
}
