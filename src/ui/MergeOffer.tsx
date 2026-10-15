import { Link2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useId } from 'react';
import { de } from '../i18n/de';
import { fade, spring } from './motion';

interface Props {
  deviceName: string;
  onMerge: () => void;
}

/** Hinweiskarte: Das Gerät aus der ZIP ist im aktuellen Modus vorhanden – Befunde zusammenführen. */
export function MergeOffer({ deviceName, onMerge }: Props) {
  const reduced = useReducedMotion();
  const titleId = useId();
  return (
    <motion.section
      aria-labelledby={titleId}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={reduced ? fade : spring}
      className="flex flex-col gap-3 hc-edge rounded-tile bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_16px_rgb(0_0_0/0.04)] sm:flex-row sm:items-center sm:gap-4"
    >
      <Link2 aria-hidden="true" size={20} className="hidden shrink-0 text-accent sm:block" />
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="text-base font-semibold text-label">
          {de.zipView.merge.title(deviceName)}
        </h2>
        <p className="mt-0.5 text-sm text-secondary-label">{de.zipView.merge.body}</p>
      </div>
      <button
        type="button"
        onClick={onMerge}
        className="shrink-0 self-start rounded-full bg-accent-fill px-4 py-2 text-sm font-medium text-white outline-none transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent active:scale-[0.97] sm:self-auto"
      >
        {de.zipView.merge.action}
      </button>
    </motion.section>
  );
}
