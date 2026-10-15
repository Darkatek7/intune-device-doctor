import { ChevronRight, Laptop, Stethoscope } from 'lucide-react';
import type { ReactNode } from 'react';
import { de } from '../i18n/de';
import type { ExampleDevice } from '../hooks/useExampleDevices';
import { EXAMPLE_CHIP_CLASS } from './chipStyles';
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
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-9 py-8 sm:py-16">
      <div className="flex flex-col items-center text-center">
        <span aria-hidden="true" className="squircle app-glyph mb-6 size-16 sm:size-20">
          <Stethoscope className="size-8 sm:size-10" strokeWidth={2} />
        </span>
        <h1 className="display-type text-[2rem] font-bold text-label sm:text-[3.25rem]">
          {de.hero.title}
        </h1>
        <p className="mt-4 max-w-md text-lg text-secondary-label text-balance">
          {de.hero.subtitle}
        </p>
      </div>
      <div className="w-full max-w-2xl">{search}</div>
      {(examples.length > 0 || extraChips) && (
        <div className="w-full">
          <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.06em] text-secondary-label">
            {de.demo.examplesTitle}
          </h2>
          <ul className="grid grid-cols-1 gap-2.5 min-[30rem]:grid-cols-2 sm:grid-cols-3">
            {examples.map((scenario) => (
              <li key={scenario.deviceName} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onPickExample(scenario.deviceName)}
                  className={EXAMPLE_CHIP_CLASS}
                >
                  <span aria-hidden="true" className="squircle size-8 bg-fill text-secondary-label">
                    <Laptop size={17} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-label">
                      {scenario.deviceName}
                    </span>
                    <span title={scenario.label} className="truncate text-xs text-secondary-label">
                      {scenario.label}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    size={16}
                    className="shrink-0 text-tertiary-label"
                  />
                </button>
              </li>
            ))}
            {extraChips}
          </ul>
        </div>
      )}
      <div className="w-full max-w-2xl">
        <DropZone onFile={onFile} />
      </div>
    </section>
  );
}
