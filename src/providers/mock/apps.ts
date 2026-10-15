/**
 * Fiktiver Intune-App-Katalog (Contoso) für den Demo-Modus. Löst die App-IDs des Beispiel-ZIPs
 * (src/diagnostics/fixture.ts) und weitere Demo-IDs zu Namen auf – wie
 * GET /deviceAppManagement/mobileApps/{id} im Live-Modus.
 */
import type { AppInfo } from '../../domain/types';

export const MOCK_APPS: AppInfo[] = [
  {
    id: '00000000-0000-0000-0000-0000000000A1',
    displayName: 'Contoso Zeiterfassung 3.4',
    publisher: 'Contoso Ltd.',
  },
  {
    id: '00000000-0000-0000-0000-0000000000A2',
    displayName: 'Contoso VPN Client 5.1',
    publisher: 'Contoso Ltd.',
  },
  {
    id: '00000000-0000-0000-0000-0000000000A3',
    displayName: 'Contoso Mac Tools',
    publisher: 'Contoso Ltd.',
  },
  {
    id: '00000000-0000-0000-0000-0000000000A4',
    displayName: 'Fabrikam PDF Studio 12',
    publisher: 'Fabrikam, Inc.',
  },
  {
    id: '00000000-0000-0000-0000-0000000000A5',
    displayName: 'Northwind CRM Desktop',
    publisher: 'Northwind Traders',
  },
];

const BY_ID = new Map(MOCK_APPS.map((app) => [app.id.toLowerCase(), app]));

export function findMockApp(appId: string): AppInfo | undefined {
  return BY_ID.get(appId.toLowerCase());
}
