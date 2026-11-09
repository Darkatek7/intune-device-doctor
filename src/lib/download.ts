/**
 * Lokaler Download per Blob-URL – nichts wird gesendet oder gespeichert (kein localStorage).
 */
export function downloadTextFile(fileName: string, text: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Erst nach dem Start des Downloads freigeben.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
