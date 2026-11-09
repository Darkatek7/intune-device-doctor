/** Größenlimits der ZIP-Auswertung, die auch die Regeln (Hauptthread) kennen müssen – ohne Parser-Code zu laden. */

/** Größenlimit je Ereignisprotokoll (.evtx, entpackt) */
export const DEFAULT_MAX_EVTX_BYTES = 48 * 1024 * 1024;

/** Größenlimit für das MDM-Diagnosepaket `mdmlogs-*.cab` (Cabinet, wie im ZIP gespeichert) */
export const DEFAULT_MAX_MDM_CAB_BYTES = 64 * 1024 * 1024;

/** Größenlimit je entpackter Datei aus dem Paket (z. B. .evtx) */
export const DEFAULT_MAX_MDM_CAB_FILE_BYTES = 32 * 1024 * 1024;

/** Größenlimit für MDMDiagReport.xml (entpackt) */
export const DEFAULT_MAX_MDM_DIAG_XML_BYTES = 16 * 1024 * 1024;
