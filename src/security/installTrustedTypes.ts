/** Nebenwirkungs-Modul: wird in main.tsx als erster Import geladen (siehe trustedTypes.ts). */
import {
  installDefaultTrustedTypesPolicy,
  type TrustedTypePolicyFactoryLike,
} from './trustedTypes';

if (import.meta.env.PROD) {
  installDefaultTrustedTypesPolicy(
    (window as unknown as { trustedTypes?: TrustedTypePolicyFactoryLike }).trustedTypes,
    window.location.origin,
    window.location.href,
  );
}
