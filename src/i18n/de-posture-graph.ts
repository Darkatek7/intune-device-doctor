/**
 * Texte des Graph-Providers für die Ansicht „Empfehlungen“ (M21/S1): Gründe, wenn eine Quelle über die
 * dokumentierte API nichts liefert. Eigene Datei, damit sie unabhängig vom Regelwerk-Text
 * (`de-posture.ts`) bleibt; bei der Integration kann sie in `de.ts` eingehängt werden.
 */
export const dePostureGraph = {
  reasons: {
    complianceSettingsNotReported:
      'Graph lieferte keine mandantenweiten Compliance-Einstellungen (deviceManagement.settings).',
    platformCountsNotReported: 'Graph lieferte keine Übersicht der verwalteten Geräte.',
    compliancePoliciesNotFound: 'Die Compliance-Richtlinien wurden von Graph nicht gefunden (404).',
    appProtectionNotFound: 'Die App-Schutzrichtlinien wurden von Graph nicht gefunden (404).',
    conditionalAccessNotFound:
      'Die Richtlinien für Bedingten Zugriff wurden von Graph nicht gefunden (404).',
    secureScoreNotReported: 'Graph lieferte keinen Secure Score für diesen Mandanten.',
    secureScoreNotFound: 'Der Secure Score wurde von Graph nicht gefunden (404).',
    catalogPoliciesNotFound:
      'Die Richtlinien des Einstellungskatalogs wurden von der Beta-API nicht gefunden (404).',
    policyTemplatesNotFound:
      'Die Richtlinienvorlagen wurden von der Beta-API nicht gefunden (404).',
    baselineNoTemplate:
      'Die Baseline-Richtlinie nennt keine Vorlage; der Vergleich mit den Standardwerten ist nicht möglich.',
    baselineSettingsNotFound:
      'Die Einstellungen der Baseline-Richtlinie wurden von der Beta-API nicht gefunden (404).',
    baselineTemplateNotFound:
      'Die Einstellungsvorlagen der Baseline wurden von der Beta-API nicht gefunden (404).',
  },
} as const;
