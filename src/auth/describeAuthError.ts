import { AuthError } from '@azure/msal-browser';

/** Fehlercode + Beschreibung von MSAL/Entra (z. B. `AADSTS50011 …`) für die Fehlersuche. */
export function describeAuthError(error: unknown): string {
  if (error instanceof AuthError) {
    return [error.errorCode, error.errorMessage].filter(Boolean).join(': ');
  }
  return error instanceof Error ? error.message : '';
}
