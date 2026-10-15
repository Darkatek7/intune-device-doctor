import {
  CircleCheck,
  CircleHelp,
  OctagonAlert,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { Severity } from '../domain/types';
import { de } from '../i18n/de';

const SEVERITY_ICON: Record<Severity, LucideIcon> = {
  ok: CircleCheck,
  warning: TriangleAlert,
  critical: OctagonAlert,
  unknown: CircleHelp,
};

const SEVERITY_TEXT_CLASS: Record<Severity, string> = {
  ok: 'text-ok',
  warning: 'text-warning',
  critical: 'text-critical',
  unknown: 'text-unknown',
};

const SEVERITY_TINT_CLASS: Record<Severity, string> = {
  ok: 'bg-ok/12',
  warning: 'bg-warning/12',
  critical: 'bg-critical/12',
  unknown: 'bg-unknown/12',
};

/** Severity-Icon (Farbe + Form, nie nur Farbe). */
export function SeverityIcon({ severity, size = 16 }: { severity: Severity; size?: number }) {
  const Icon = SEVERITY_ICON[severity];
  return (
    <Icon
      aria-hidden="true"
      size={size}
      strokeWidth={2.25}
      className={`shrink-0 ${SEVERITY_TEXT_CLASS[severity]}`}
    />
  );
}

/** Status-Badge: Icon + Text. Der Text bleibt in der Label-Farbe (Kontrast ≥ 4.5:1), das Icon trägt die Farbe. */
export function SeverityBadge({
  severity,
  label,
  className = '',
}: {
  severity: Severity;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-label ${SEVERITY_TINT_CLASS[severity]} ${className}`}
    >
      <SeverityIcon severity={severity} size={14} />
      {label ?? de.severity[severity]}
    </span>
  );
}
