/**
 * Texte der Regel-Engine (Befund · Ursache · Lösung), Teil von `de` (de.rules).
 * Lösungen sind read-only formuliert: Der Admin handelt im Intune Admin Center bzw. am Gerät.
 */
export const deRules = {
  common: {
    unknownScope: 'unbekannter Scope',
    forbiddenTitle: 'Fehlende Berechtigung',
    forbiddenSummary: (scope: string) => `Benötigt ${scope}`,
    forbiddenDetail: (endpoint: string) =>
      `Microsoft Graph hat den Aufruf ${endpoint} mit HTTP 403 abgelehnt.`,
    forbiddenCause: (scope: string) =>
      `Der App fehlt die delegierte Berechtigung ${scope} (kein Admin-Consent), oder dem angemeldeten Konto fehlt eine passende Intune-/Entra-Rolle bzw. ein Bereichstag oder eine Lizenz.`,
    forbiddenRemediation: (scope: string) => [
      `Berechtigung ${scope} in der App-Registrierung hinzufügen und Admin-Consent durch einen Global Administrator bzw. Privileged Role Administrator erteilen lassen.`,
      'Prüfen, ob das Konto eine lesende Rolle hat (z. B. Intune „Read Only Operator“ oder Entra „Global Reader“) und das Gerät im zugewiesenen Bereich (Scope-Tag) liegt.',
      'Abmelden und erneut anmelden, damit das Token die neue Berechtigung enthält.',
    ],
    notApplicableTitle: 'Für dieses Gerät nicht anwendbar',
    notApplicableCause: 'Die Datenquelle gilt für diese Plattform nicht.',
    notApplicableRemediation:
      'Keine Aktion nötig – den entsprechenden Status ggf. im Intune Admin Center plattformspezifisch prüfen.',
    unavailableTitle: 'Daten nicht verfügbar',
    unavailableCause:
      'Das Gerät hat diese Daten (noch) nicht gemeldet, oder sie sind über die dokumentierte API nicht abrufbar.',
    unavailableRemediation:
      'Nach dem nächsten Check-in erneut prüfen; Status zusätzlich im Intune Admin Center kontrollieren.',
    errorTitle: 'Fehler beim Laden',
    errorCause:
      'Der Aufruf an Microsoft Graph ist fehlgeschlagen (Netzwerk, Dienststörung oder unerwartete Antwort).',
    errorRemediation:
      'Über „Erneut laden“ wiederholen. Bleibt der Fehler, Request-ID notieren und den Microsoft-365-Dienststatus prüfen.',
    throttledTitle: 'Anfragen werden gedrosselt',
    throttledCause:
      'Microsoft Graph begrenzt die Anzahl der Anfragen pro App und Tenant (HTTP 429).',
    throttledRemediation:
      'Kurz warten und dann „Erneut laden“ wählen – die App wartet automatisch die von Graph genannte Zeit (Retry-After) ab.',
  },
} as const;
