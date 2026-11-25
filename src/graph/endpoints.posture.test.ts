/** M21/S1: Endpunkt-Definitionen der Ansicht „Empfehlungen“. */
import { describe, expect, it } from 'vitest';
import { Endpoints, GRAPH_BETA_URL, type EndpointId } from './endpoints';
import { GraphScope, LOGIN_SCOPES, OPTIONAL_SCOPES } from './scopes';

const POSTURE_IDS: EndpointId[] = [
  'deviceManagementSettings',
  'managedDeviceOverview',
  'deviceCompliancePolicyScheduledActions',
  'deviceCompliancePolicyScheduledActionItems',
  'iosManagedAppProtections',
  'androidManagedAppProtections',
  'conditionalAccessPolicies',
  'secureScores',
  'secureScoreControlProfiles',
  'catalogPolicies',
  'catalogPolicySettings',
  'policyTemplates',
  'policyTemplateSettingTemplates',
];

describe('Endpunkte – Empfehlungen (M21)', () => {
  it('nur GET, Learn-Link, Scope und lesbare Anzeige', () => {
    for (const id of POSTURE_IDS) {
      const def = Endpoints[id];
      expect(def.method).toBe('GET');
      expect(def.docsUrl).toMatch(/^https:\/\/learn\.microsoft\.com\/en-us\/(graph|powershell)\//);
      expect(def.docsUrl).toContain(def.version === 'beta' ? 'graph-rest-beta' : 'graph-rest-1.0');
      expect(def.display.startsWith('GET /')).toBe(true);
    }
  });

  it('Beta nur für die vier freigegebenen Katalog-Endpunkte; absolute Beta-URL', () => {
    const beta = POSTURE_IDS.filter((id) => Endpoints[id].version === 'beta').sort();
    expect(beta).toEqual([
      'catalogPolicies',
      'catalogPolicySettings',
      'policyTemplateSettingTemplates',
      'policyTemplates',
    ]);
    expect(Endpoints.catalogPolicies.path()).toBe(
      `${GRAPH_BETA_URL}/deviceManagement/configurationPolicies`,
    );
    expect(Endpoints.catalogPolicySettings.path('a/b')).toBe(
      `${GRAPH_BETA_URL}/deviceManagement/configurationPolicies/a%2Fb/settings`,
    );
    expect(Endpoints.policyTemplates.path()).toBe(
      `${GRAPH_BETA_URL}/deviceManagement/configurationPolicyTemplates`,
    );
    expect(Endpoints.policyTemplateSettingTemplates.path('t_1')).toBe(
      `${GRAPH_BETA_URL}/deviceManagement/configurationPolicyTemplates/t_1/settingTemplates`,
    );
  });

  it('v1.0-Pfade und dokumentierte Query-Optionen', () => {
    expect(Endpoints.deviceManagementSettings.path()).toBe('/deviceManagement?$select=settings');
    expect(Endpoints.managedDeviceOverview.path()).toBe('/deviceManagement/managedDeviceOverview');
    expect(Endpoints.deviceCompliancePolicyScheduledActions.path('p 1')).toBe(
      '/deviceManagement/deviceCompliancePolicies/p%201/scheduledActionsForRule',
    );
    expect(Endpoints.deviceCompliancePolicyScheduledActionItems.path('p', 'r')).toBe(
      '/deviceManagement/deviceCompliancePolicies/p/scheduledActionsForRule/r/scheduledActionConfigurations',
    );
    expect(Endpoints.iosManagedAppProtections.path()).toBe(
      '/deviceAppManagement/iosManagedAppProtections',
    );
    expect(Endpoints.androidManagedAppProtections.path()).toBe(
      '/deviceAppManagement/androidManagedAppProtections',
    );
    expect(Endpoints.conditionalAccessPolicies.path()).toBe(
      '/identity/conditionalAccess/policies?$select=id%2CdisplayName%2Cstate%2Cconditions%2CgrantControls',
    );
    expect(Endpoints.secureScores.path()).toBe('/security/secureScores?$top=1');
    expect(Endpoints.secureScoreControlProfiles.path()).toBe(
      '/security/secureScoreControlProfiles',
    );
  });

  it('Scopes: neue Scopes sind optional und werden beim Login nicht angefragt', () => {
    expect(Endpoints.conditionalAccessPolicies.scope).toBe(GraphScope.PolicyRead);
    expect(Endpoints.secureScores.scope).toBe(GraphScope.SecurityEventsRead);
    expect(Endpoints.secureScoreControlProfiles.scope).toBe(GraphScope.SecurityEventsRead);
    expect(Endpoints.managedDeviceOverview.scope).toBe(GraphScope.ManagedDevicesRead);
    expect(Endpoints.iosManagedAppProtections.scope).toBe(GraphScope.ManagementAppsRead);
    expect(GraphScope.PolicyRead).toBe('Policy.Read.All');
    expect(GraphScope.SecurityEventsRead).toBe('SecurityEvents.Read.All');
    for (const scope of [GraphScope.PolicyRead, GraphScope.SecurityEventsRead]) {
      expect(OPTIONAL_SCOPES).toContain(scope);
      expect(LOGIN_SCOPES).not.toContain(scope);
    }
  });
});
