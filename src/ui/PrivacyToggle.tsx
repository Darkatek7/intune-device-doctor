import { Eye, EyeOff } from 'lucide-react';
import { de } from '../i18n/de';
import { usePrivacy } from '../privacy/privacyContext';

/**
 * Schalter „Präsentationsmodus“ (M19): verbirgt Namen und Kennungen für Screenshots und Bildschirmfreigabe.
 * Der Name bleibt gleich, `aria-pressed` trägt den Zustand; der Tooltip nennt die Aktion.
 */
export function PrivacyToggle() {
  const { enabled, toggle } = usePrivacy();
  const Icon = enabled ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={de.privacy.toggle.label}
      title={enabled ? de.privacy.toggle.hintOn : de.privacy.toggle.hintOff}
      data-testid="privacy-toggle"
      className={`grid size-9 shrink-0 place-items-center rounded-full outline-none transition-transform hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.94] ${
        enabled ? 'bg-accent-fill text-white' : 'bg-control text-label'
      }`}
    >
      <Icon aria-hidden="true" size={18} />
    </button>
  );
}

/**
 * Dauerhafter, ruhiger Hinweis, solange der Modus an ist – damit niemand Pseudonyme für echte Namen hält
 * (und weiß, was sichtbar bleibt).
 */
export function PrivacyNotice() {
  const { enabled } = usePrivacy();
  if (!enabled) return null;
  return (
    <div
      role="status"
      aria-label={de.privacy.notice.label}
      data-testid="privacy-notice"
      className="border-t border-separator bg-accent/10"
    >
      <p className="mx-auto flex max-w-[80rem] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-xs text-label sm:px-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-fill px-2.5 py-0.5 font-semibold text-white">
          <EyeOff aria-hidden="true" size={12} />
          {de.privacy.notice.pill}
        </span>
        <span className="min-w-0 text-secondary-label">{de.privacy.notice.body}</span>
      </p>
    </div>
  );
}
