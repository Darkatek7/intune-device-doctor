import type { AnchorHTMLAttributes } from 'react';
import { usePrivacyView } from '../privacy/privacyContext';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string };

/**
 * Externer Link, dessen Adresse Kennungen enthalten kann (Intune-Portal mit Geräte-/App-ID). Im
 * Präsentationsmodus zeigt `href` (Statusleiste, Kopieren) die maskierte Adresse; ein Klick öffnet weiter
 * die echte – die Funktion bleibt, nur das Sichtbare ist verborgen.
 */
export function PrivateLink({ href, onClick, ...rest }: Props) {
  const view = usePrivacyView();
  if (!view.enabled) return <a href={href} onClick={onClick} {...rest} />;
  return (
    <a
      {...rest}
      href={view.text(href)}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        window.open(href, '_blank', 'noopener,noreferrer');
      }}
    />
  );
}
