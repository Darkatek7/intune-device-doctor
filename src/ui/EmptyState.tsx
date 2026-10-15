import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** z. B. ein Button */
  action?: ReactNode;
}

/** Freundlicher Leerzustand (nichts gefunden, Live noch nicht verfügbar …). */
export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <span aria-hidden="true" className="squircle mb-2 size-16 bg-fill text-secondary-label">
        <Icon size={32} strokeWidth={1.5} />
      </span>
      <h1 className="text-title font-semibold text-label">{title}</h1>
      {description && <p className="text-base text-secondary-label">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
