/** Größenlimits der ZIP-Auswertung, die auch die Regeln (Hauptthread) kennen müssen – ohne Parser-Code zu laden. */

/** Größenlimit je Ereignisprotokoll (.evtx, entpackt) */
export const DEFAULT_MAX_EVTX_BYTES = 48 * 1024 * 1024;
