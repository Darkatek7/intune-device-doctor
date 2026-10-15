/**
 * Drag & Drop einer Datei auf die gesamte Seite. Liefert `true`, solange eine Datei über das
 * Fenster gezogen wird (für das Drop-Overlay). Bereits behandelte Drops (z. B. durch die
 * Drop-Zone, `defaultPrevented`) werden nicht doppelt verarbeitet.
 */
import { useEffect, useRef, useState } from 'react';

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

export function usePageFileDrop(enabled: boolean, onFile: (file: File) => void): boolean {
  const [dragging, setDragging] = useState(false);
  const handler = useRef(onFile);
  useEffect(() => {
    handler.current = onFile;
  });

  useEffect(() => {
    if (!enabled) return;
    let depth = 0;

    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth++;
      setDragging(true);
    };
    const onOver = (event: DragEvent) => {
      // Ohne preventDefault würde der Browser die Datei beim Ablegen selbst öffnen.
      if (hasFiles(event)) event.preventDefault();
    };
    const onLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = 0;
      setDragging(false);
      if (event.defaultPrevented) return;
      event.preventDefault();
      const file = event.dataTransfer?.files[0];
      if (file) handler.current(file);
    };

    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
      setDragging(false);
    };
  }, [enabled]);

  return enabled && dragging;
}
