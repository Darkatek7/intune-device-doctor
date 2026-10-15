import { ExternalLink, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DataSource, Finding } from '../domain/types';
import { de } from '../i18n/de';
import { EvidenceTable } from './EvidenceTable';
import { SeverityBadge, SeverityIcon } from './SeverityBadge';

/** "Quelle: GET …" – Demo-Daten werden ausdrücklich gekennzeichnet; optional mit Docs-Link. */
export function SourceLine({ source, docsUrl }: { source: DataSource; docsUrl?: string }) {
  const label = source.kind === 'mock' ? de.sheet.demoSource(source.label) : source.label;
  const href = docsUrl ?? source.docsUrl;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-secondary-label">
      <span className="font-medium">{de.detail.source}:</span>
      <span className="break-all font-mono">{label}</span>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded text-accent underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
        >
          {de.detail.docs}
          <ExternalLink aria-hidden="true" size={12} />
        </a>
      )}
    </p>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-secondary-label">
        {title}
      </h4>
      <div className="mt-1 text-base text-label">{children}</div>
    </div>
  );
}

/** Ein Befund: Titel → Befund → Ursache → Lösung (nummeriert) → Rohdaten → Quelle. */
export function FindingCard({ finding }: { finding: Finding }) {
  const isHint = finding.severity === 'unknown';
  return (
    <article className="hc-edge flex flex-col gap-4 rounded-2xl bg-fill p-4 shadow-[inset_0_1px_0_var(--c-highlight)]">
      <header className="flex items-start gap-2">
        {isHint ? (
          <Info aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-unknown" />
        ) : (
          <span className="mt-0.5">
            <SeverityIcon severity={finding.severity} size={18} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-label">{finding.title}</h3>
          <SeverityBadge
            severity={finding.severity}
            label={isHint ? de.sheet.hint : undefined}
            className="mt-1"
          />
        </div>
      </header>
      <Section title={de.detail.finding}>
        <p>{finding.detail}</p>
      </Section>
      {finding.cause && (
        <Section title={de.detail.cause}>
          <p>{finding.cause}</p>
        </Section>
      )}
      {finding.remediation.length > 0 && (
        <Section title={de.detail.remediation}>
          <ol className="mt-1 space-y-2.5 [counter-reset:step]">
            {finding.remediation.map((step, index) => (
              <li
                key={index}
                className="flex gap-3 [counter-increment:step] before:mt-0.5 before:grid before:size-6 before:shrink-0 before:place-items-center before:rounded-full before:bg-accent/15 before:text-xs before:font-semibold before:text-accent before:tabular-nums before:content-[counter(step)]"
              >
                <span className="min-w-0">{step}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}
      {finding.links && finding.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {finding.links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-accent/6 px-3 py-1.5 text-sm font-medium text-accent outline-none transition-transform hover:bg-accent/8 focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
            >
              {link.label}
              <ExternalLink aria-hidden="true" size={14} />
            </a>
          ))}
        </div>
      )}
      {finding.evidence && <EvidenceTable evidence={finding.evidence} />}
      <SourceLine source={finding.source} docsUrl={finding.docsUrl} />
    </article>
  );
}
