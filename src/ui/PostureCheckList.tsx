/**
 * Liste „Alle Empfehlungen“ im Detail-Sheet der Ansicht „Empfehlungen“ (M21): jede Einzelprüfung einer
 * Kachel – erfüllt, weicht ab, nicht prüfbar – mit Ist-Wert, Empfehlung, Stufe und eigenem Learn-Link,
 * nach Richtlinie gruppiert. Filter als Radiogruppe (Pfeiltasten, roving tabindex); Zustand nur lokal.
 */
import { CircleCheck, CircleHelp, ExternalLink, TriangleAlert } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import { de } from '../i18n/de';
import type { PostureCheckResult } from '../rules/posture';

const t = de.posture.view.checks;
const status = de.posture.view.overall;

type Filter = 'deviating' | 'notChecked' | 'met' | 'all';
const FILTERS: readonly Filter[] = ['deviating', 'notChecked', 'met', 'all'];
const RANK: Record<PostureCheckResult['status'], number> = { deviating: 0, notChecked: 1, met: 2 };

const STATUS = {
  met: { Icon: CircleCheck, text: status.met, className: 'text-ok' },
  deviating: { Icon: TriangleAlert, text: status.deviating, className: 'text-warning' },
  notChecked: { Icon: CircleHelp, text: status.notChecked, className: 'text-unknown' },
} as const;

interface Group {
  subject: string | null;
  checks: PostureCheckResult[];
}

/** Gruppen in Reihenfolge des ersten Auftretens; innerhalb: Abweichungen, nicht prüfbar, erfüllt. */
function groupChecks(checks: readonly PostureCheckResult[]): Group[] {
  const groups = new Map<string | null, PostureCheckResult[]>();
  for (const check of checks) {
    const key = check.subject ?? null;
    groups.set(key, [...(groups.get(key) ?? []), check]);
  }
  return [...groups].map(([subject, items]) => ({
    subject,
    checks: items
      .map((check, index) => ({ check, index }))
      .sort((a, b) => RANK[a.check.status] - RANK[b.check.status] || a.index - b.index)
      .map((entry) => entry.check),
  }));
}

function matches(check: PostureCheckResult, filter: Filter): boolean {
  return filter === 'all' || check.status === filter;
}

function CheckRow({ check }: { check: PostureCheckResult }) {
  const { Icon, text, className } = STATUS[check.status];
  return (
    <li data-testid="posture-check" data-status={check.status} className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className={`inline-flex items-center gap-1 font-semibold ${className}`}>
          <Icon aria-hidden="true" size={14} />
          {text}
        </span>
        {check.level !== null && (
          <span className="rounded-full bg-fill px-2 py-0.5 font-medium text-secondary-label">
            {de.posture.levelShort(check.level)}
          </span>
        )}
        {!check.counted && <span className="text-secondary-label">{t.notCounted}</span>}
      </div>
      <p className="break-words text-sm font-medium text-label">{check.label}</p>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs text-secondary-label">{t.actual}</dt>
          <dd className="break-words text-label">{check.actual}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-secondary-label">{t.expected}</dt>
          <dd className="break-words text-label">{check.expected}</dd>
        </div>
        {check.status === 'notChecked' && check.reason && check.reason !== check.actual && (
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-xs text-secondary-label">{t.reason}</dt>
            <dd className="break-words text-label">{check.reason}</dd>
          </div>
        )}
      </dl>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
        {check.properties && check.properties.length > 0 ? (
          <code
            lang="en"
            title={t.technicalName}
            className="min-w-0 break-all font-mono text-secondary-label"
          >
            {check.properties.join(', ')}
          </code>
        ) : (
          <span />
        )}
        <a
          href={check.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.sourceLabel(check.label)}
          className="inline-flex items-center gap-1 rounded text-accent underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
        >
          {t.learn}
          <ExternalLink aria-hidden="true" size={12} />
        </a>
      </div>
    </li>
  );
}

export function PostureCheckList({ checks }: { checks: readonly PostureCheckResult[] }) {
  const counts: Record<Filter, number> = {
    deviating: checks.filter((c) => c.status === 'deviating').length,
    notChecked: checks.filter((c) => c.status === 'notChecked').length,
    met: checks.filter((c) => c.status === 'met').length,
    all: checks.length,
  };
  const [filter, setFilter] = useState<Filter>(() => (counts.deviating > 0 ? 'deviating' : 'all'));
  const refs = useRef<Partial<Record<Filter, HTMLButtonElement | null>>>({});

  const move = (next: Filter) => {
    setFilter(next);
    refs.current[next]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const index = FILTERS.indexOf(filter);
    let next: Filter | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = FILTERS[(index + 1) % FILTERS.length];
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = FILTERS[(index + FILTERS.length - 1) % FILTERS.length];
    } else if (event.key === 'Home') next = FILTERS[0];
    else if (event.key === 'End') next = FILTERS[FILTERS.length - 1];
    if (next === undefined) return;
    event.preventDefault();
    move(next);
  };

  const visible = groupChecks(checks.filter((check) => matches(check, filter))).filter(
    (group) => group.checks.length > 0,
  );

  return (
    <section data-testid="posture-check-list" aria-label={t.title} className="flex flex-col gap-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-secondary-label">
          {t.title}
        </h3>
        <p className="mt-1 text-sm text-secondary-label">{t.intro}</p>
      </div>
      <div
        role="radiogroup"
        aria-label={t.filterLabel}
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-1 rounded-2xl bg-fill p-1"
      >
        {FILTERS.map((option) => {
          const checked = option === filter;
          return (
            <button
              key={option}
              ref={(element) => {
                refs.current[option] = element;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => setFilter(option)}
              className={`min-w-0 flex-1 rounded-xl px-2.5 py-1.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                checked
                  ? 'bg-surface font-semibold text-label shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                  : 'font-medium text-secondary-label'
              }`}
            >
              {t.filters[option]} <span className="tabular-nums">({counts[option]})</span>
            </button>
          );
        })}
      </div>
      {visible.length === 0 ? (
        <p role="status" className="py-2 text-sm text-secondary-label">
          {checks.length === 0 ? t.empty.all : t.empty[filter]}
        </p>
      ) : (
        visible.map((group) => (
          <div key={group.subject ?? ''} data-testid="posture-check-group">
            {group.subject !== null && (
              <h4 className="break-words text-sm font-semibold text-label">{group.subject}</h4>
            )}
            <ul
              aria-label={group.subject ?? t.general}
              className="hc-edge mt-1 divide-y divide-separator rounded-2xl bg-fill px-4"
            >
              {group.checks.map((check) => (
                <CheckRow key={check.id} check={check} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
