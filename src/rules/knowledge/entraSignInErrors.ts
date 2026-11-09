/**
 * Entra-Fehlercodes (status.errorCode des Anmeldeprotokolls, im Portal mit Präfix AADSTS). Nur Codes,
 * die auf Microsoft Learn mit Bedeutung stehen – jeder Eintrag trägt seine Quelle (Test erzwingt das).
 *
 * - https://learn.microsoft.com/entra/identity-platform/reference-error-codes#aadsts-error-codes
 * - https://learn.microsoft.com/entra/identity/conditional-access/troubleshoot-conditional-access#common-conditional-access-error-codes
 */
const ERROR_CODES_URL =
  'https://learn.microsoft.com/entra/identity-platform/reference-error-codes#aadsts-error-codes';
const CA_COMMON_CODES_URL =
  'https://learn.microsoft.com/entra/identity/conditional-access/troubleshoot-conditional-access#common-conditional-access-error-codes';

export interface EntraSignInError {
  code: number;
  /** Name laut Microsoft, z. B. "DeviceNotCompliant" */
  name: string;
  title: string;
  cause: string;
  remediation: string[];
  docsUrl: string;
}

const DEVICE_REMEDIATION = [
  'In Intune den Compliance-Status des Geräts und den letzten Check-in prüfen (Kacheln „Compliance“ und „Letzter Check-in“).',
  'Im Entra Admin Center beim Anmeldeeintrag (Korrelations-ID) auf dem Tab „Conditional Access“ prüfen, welche Richtlinie welche Zugriffssteuerung verlangt.',
];

/** Vorgehen, wenn Conditional Access ohne (belegt gedeuteten) Fehlercode abgewiesen hat. */
export const POLICY_REMEDIATION = [
  'Im Entra Admin Center unter Entra ID › Überwachung & Integrität › Anmeldeprotokolle den Eintrag (Korrelations-ID) öffnen und auf dem Tab „Conditional Access“ die auslösende Richtlinie ansehen.',
  'Ist die Blockade unerwartet, die Richtlinie prüfen (Zuweisungen, Bedingungen, Ausschlüsse) – z. B. mit dem „What If“-Werkzeug von Conditional Access.',
];

export const ENTRA_SIGN_IN_ERRORS: EntraSignInError[] = [
  {
    code: 53000,
    name: 'DeviceNotCompliant',
    title: 'Gerät nicht konform (AADSTS53000)',
    cause:
      'Eine Conditional-Access-Richtlinie verlangt ein konformes Gerät, und das Gerät ist nicht konform. Der Benutzer muss das Gerät bei einem zugelassenen MDM-Anbieter wie Intune registrieren.',
    remediation: DEVICE_REMEDIATION,
    docsUrl: ERROR_CODES_URL,
  },
  {
    code: 53001,
    name: 'DeviceNotDomainJoined',
    title: 'Gerät nicht in die Domäne eingebunden (AADSTS53001)',
    cause:
      'Eine Conditional-Access-Richtlinie verlangt ein in die Domäne eingebundenes Gerät, und das Gerät ist nicht in die Domäne eingebunden. Der Benutzer muss ein in die Domäne eingebundenes Gerät verwenden.',
    remediation: [
      'Prüfen, ob die Anmeldung von einem in die Domäne eingebundenen Gerät erfolgt – laut Microsoft muss der Benutzer ein solches Gerät verwenden.',
      ...POLICY_REMEDIATION,
    ],
    docsUrl: ERROR_CODES_URL,
  },
  {
    code: 53002,
    name: 'ApplicationUsedIsNotAnApprovedApp',
    title: 'App für Conditional Access nicht genehmigt (AADSTS53002)',
    cause:
      'Die verwendete App ist für Conditional Access keine genehmigte App. Der Benutzer muss eine der genehmigten Apps verwenden, um Zugriff zu erhalten.',
    remediation: POLICY_REMEDIATION,
    docsUrl: ERROR_CODES_URL,
  },
  {
    code: 53003,
    name: 'BlockedByConditionalAccess',
    title: 'Durch Conditional Access blockiert (AADSTS53003)',
    cause:
      'Der Zugriff wurde durch Conditional-Access-Richtlinien blockiert: Die Zugriffsrichtlinie erlaubt keine Tokenausstellung.',
    remediation: POLICY_REMEDIATION,
    docsUrl: ERROR_CODES_URL,
  },
  {
    code: 53004,
    name: 'ProofUpBlockedDueToRisk',
    title: 'MFA-Registrierung durch Risiko blockiert (AADSTS53004)',
    cause:
      'Der Benutzer muss die Registrierung der Multifaktor-Authentifizierung abschließen, bevor er auf den Inhalt zugreifen kann.',
    remediation: POLICY_REMEDIATION,
    docsUrl: ERROR_CODES_URL,
  },
  {
    code: 53009,
    name: 'Application needs to enforce Intune protection policies',
    title: 'App muss Intune-Schutzrichtlinien erzwingen (AADSTS53009)',
    cause:
      'Laut Microsoft muss die App Intune-App-Schutzrichtlinien erzwingen, damit der Zugriff möglich ist.',
    remediation: POLICY_REMEDIATION,
    docsUrl: CA_COMMON_CODES_URL,
  },
  {
    code: 530035,
    name: 'BlockedBySecurityDefaults',
    title: 'Durch Sicherheitsstandards blockiert (AADSTS530035)',
    cause:
      'Der Zugriff wurde durch die Sicherheitsstandards blockiert, weil die Anfrage veraltete Authentifizierung verwendet oder von den Sicherheitsstandards als unsicher eingestuft wurde.',
    remediation: [
      'Prüfen, ob der Client veraltete Authentifizierung (Legacy Auth) verwendet, und auf moderne Authentifizierung umstellen.',
      'Im Anmeldeprotokoll den Eintrag (Korrelations-ID) öffnen und die Details der Anmeldung prüfen.',
    ],
    docsUrl: ERROR_CODES_URL,
  },
];

/** Erklärung zu einem Entra-Fehlercode oder null, wenn der Code nicht belegt ist (dann nichts deuten). */
export function findEntraSignInError(code: number | null | undefined): EntraSignInError | null {
  if (code === null || code === undefined) return null;
  return ENTRA_SIGN_IN_ERRORS.find((entry) => entry.code === code) ?? null;
}
