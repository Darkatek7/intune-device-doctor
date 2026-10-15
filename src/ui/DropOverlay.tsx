import { FileUp } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { de } from '../i18n/de';
import { fade, spring } from './motion';

interface Props {
  visible: boolean;
}

/** Vollflächiges Overlay, solange eine Datei über die Seite gezogen wird (nimmt keine Klicks an). */
export function DropOverlay({ visible }: Props) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="drop-overlay"
          data-testid="drop-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-canvas/80 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={reduced ? false : { scale: 0.96 }}
            animate={{ scale: 1 }}
            transition={spring}
            className="flex w-full max-w-md flex-col items-center gap-2 rounded-tile border-2 border-dashed border-accent bg-accent/12 p-10 text-center"
          >
            <FileUp aria-hidden="true" size={36} className="text-accent" />
            <p className="text-title font-semibold text-label">{de.zipView.overlay.title}</p>
            <p className="text-sm text-secondary-label">{de.dropZone.privacy}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
