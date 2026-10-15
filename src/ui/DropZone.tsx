import { FileUp } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';
import { de } from '../i18n/de';

interface Props {
  /** Ohne Handler (vor M5) ist die Zone deaktiviert und weist darauf hin. */
  onFile?: (file: File) => void;
}

function isZip(file: File): boolean {
  return file.name.toLowerCase().endsWith('.zip');
}

/** Drop-Zone für DiagLogs-ZIPs – auch als Datei-Button bedienbar. Die Datei wird nie hochgeladen. */
export function DropZone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [over, setOver] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const enabled = Boolean(onFile);

  const handle = (file: File | undefined) => {
    if (!file || !onFile) return;
    if (!isZip(file)) {
      setMessage(de.dropZoneUi.notZip);
      return;
    }
    setMessage(null);
    onFile(file);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setOver(false);
    handle(event.dataTransfer.files[0]);
  };

  return (
    <div
      role="group"
      aria-label={de.dropZoneUi.label}
      aria-describedby={hintId}
      onDragOver={(event) => {
        if (!enabled) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`flex flex-col items-center gap-2 rounded-tile border border-dashed p-6 text-center transition-colors ${
        over ? 'border-accent bg-accent/12' : 'border-separator bg-surface/60'
      }`}
    >
      <FileUp aria-hidden="true" size={24} className="text-secondary-label" />
      <p className="text-base text-label">{over ? de.dropZoneUi.dropActive : de.dropZone.hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        hidden
        data-testid="dropzone-input"
        onChange={(event) => {
          handle(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={!enabled}
        onClick={() => inputRef.current?.click()}
        className="rounded-full bg-separator px-4 py-1.5 text-sm font-medium text-label outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {de.dropZoneUi.choose}
      </button>
      <p id={hintId} className="text-sm text-secondary-label">
        {de.dropZone.privacy}
        {!enabled && <> {de.dropZoneUi.comingSoon}</>}
      </p>
      <p role="alert" className="text-sm text-critical">
        {message}
      </p>
    </div>
  );
}
