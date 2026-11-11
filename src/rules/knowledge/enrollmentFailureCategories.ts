/**
 * Wissensbasis M18: Fehlerkategorien fehlgeschlagener Registrierungen (deviceEnrollmentFailureReason).
 * Jede Kategorie aus der Enum-Seite ist enthalten; die Ursache ist die Microsoft-Beschreibung des
 * Enum-Werts, die Lösungsschritte stammen aus der jeweils verlinkten Microsoft-Learn-Seite. Wo Learn keine
 * kategoriespezifischen Schritte nennt, verweisen die Schritte auf den Intune-Bericht
 * „Registrierungsfehler“ (zeigt je Fehler Microsofts empfohlene Schritte) und die Selbsthilfe-Diagnose.
 * Texte: `de.service.failures` (src/i18n/de-service.ts).
 */
import type { DeviceEnrollmentFailureReason } from '../../graph/dto';
import { Docs } from './docs';

export interface EnrollmentFailureKnowledge {
  /** Microsoft-Learn-Quelle der Lösungsschritte */
  docsUrl: string;
}

export const ENROLLMENT_FAILURE_KNOWLEDGE: Record<
  DeviceEnrollmentFailureReason,
  EnrollmentFailureKnowledge
> = {
  unknown: { docsUrl: Docs.enrollmentFailuresReport },
  authentication: { docsUrl: Docs.enrollmentDeviceDateTime },
  authorization: { docsUrl: Docs.enrollmentFailuresReport },
  accountValidation: { docsUrl: Docs.enrollmentMdmAuthorityNotSet },
  userValidation: { docsUrl: Docs.enrollmentLicenseMissing },
  deviceNotSupported: { docsUrl: Docs.enrollmentFailuresReport },
  inMaintenance: { docsUrl: Docs.enrollmentErrorCodes },
  badRequest: { docsUrl: Docs.enrollmentFailuresReport },
  featureNotSupported: { docsUrl: Docs.enrollmentFailuresReport },
  enrollmentRestrictionsEnforced: { docsUrl: Docs.enrollmentRestrictions },
  clientDisconnected: { docsUrl: Docs.enrollmentFailuresReport },
  userAbandonment: { docsUrl: Docs.enrollmentFailuresReport },
};
