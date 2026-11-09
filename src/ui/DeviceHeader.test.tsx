import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { DeviceSearchResult, ManagedDeviceInfo } from '../domain/types';
import { de } from '../i18n/de';
import { IntunePortal } from '../links/intunePortal';
import { DeviceHeader } from './DeviceHeader';
import { deviceIconKind } from './deviceIcon';

const device: ManagedDeviceInfo = {
  id: 'dev-0001',
  deviceName: 'CONTOSO-PC042',
  osFamily: 'windows',
  operatingSystem: 'Windows',
  osVersion: '10.0.22631',
  model: 'Contoso Laptop',
  manufacturer: 'Contoso',
  serialNumber: null,
  userId: null,
  userPrincipalName: null,
  userDisplayName: null,
  complianceState: 'compliant',
  complianceGracePeriodExpirationDateTime: null,
  lastSyncDateTime: null,
  enrolledDateTime: null,
  managementAgent: 'mdm',
  deviceEnrollmentType: 'userEnrollment',
  isEncrypted: null,
  jailBroken: null,
  azureADDeviceId: null,
  partnerReportedThreatState: 'unknown',
  freeStorageSpaceInBytes: null,
  totalStorageSpaceInBytes: null,
  managementCertificateExpirationDate: null,
  isSupervised: null,
  androidSecurityPatchLevel: null,
  enrollmentProfileName: null,
  source: { kind: 'mock', label: 'GET /deviceManagement/managedDevices/{id}' },
};

describe('DeviceHeader', () => {
  it('verlinkt Gerät und Managed Apps im Intune Admin Center (neuer Tab, tastaturbedienbar)', async () => {
    const user = userEvent.setup();
    render(<DeviceHeader device={device} summary={null} totalTiles={0} />);

    const deviceLink = screen.getByRole('link', { name: de.links.openDevice });
    const appsLink = screen.getByRole('link', { name: de.links.openManagedApps });
    const inventoryLink = screen.getByRole('link', { name: de.links.openDeviceInventory });
    expect(deviceLink).toHaveAttribute('href', IntunePortal.device('dev-0001'));
    expect(appsLink).toHaveAttribute('href', IntunePortal.deviceManagedApps('dev-0001'));
    expect(inventoryLink).toHaveAttribute('href', IntunePortal.deviceInventory('dev-0001'));
    for (const link of [deviceLink, appsLink, inventoryLink]) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }

    await user.tab();
    expect(deviceLink).toHaveFocus();
    await user.tab();
    expect(appsLink).toHaveFocus();
    await user.tab();
    expect(inventoryLink).toHaveFocus();
  });

  it('zeigt kurze sichtbare Linktexte, der volle Text bleibt A11y-Name und Tooltip', () => {
    render(<DeviceHeader device={device} summary={null} totalTiles={0} />);
    const appsLink = screen.getByRole('link', { name: de.links.openManagedApps });
    expect(appsLink).toHaveTextContent(de.links.shortManagedApps);
    expect(appsLink).toHaveAttribute('title', de.links.openManagedApps);
  });

  it.each([
    ['ios', 'iPhone 15', 'smartphone'],
    ['ios', 'iPad Air', 'tablet'],
    ['android', 'Pixel 8', 'smartphone'],
    ['macos', 'MacBook Pro', 'laptop'],
    ['windows', 'Surface Laptop 5', 'laptop'],
  ] as const)('Geräte-Symbol: %s / %s', (osFamily, model, kind) => {
    expect(deviceIconKind({ ...device, osFamily, model })).toBe(kind);
  });

  it('zeigt ohne Gerät keine Portal-Links', () => {
    render(<DeviceHeader device={null} summary={null} totalTiles={0} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('DeviceHeader – weitere Geräte', () => {
  const other = (
    n: number,
    os = 'iOS',
    complianceState: DeviceSearchResult['complianceState'] = 'compliant',
  ) =>
    ({
      id: `other-${n}`,
      deviceName: `CONTOSO-IP0${n}`,
      userPrincipalName: null,
      userDisplayName: null,
      operatingSystem: os,
      osVersion: null,
      model: null,
      complianceState,
      lastSyncDateTime: null,
    }) satisfies DeviceSearchResult;
  const named = { ...device, userDisplayName: 'Jonas Weber' };

  it('zeigt höchstens fünf Geräte mit Compliance im Namen und öffnet sie per Klick', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    render(
      <DeviceHeader
        device={named}
        summary={null}
        totalTiles={9}
        otherDevices={[1, 2, 3, 4, 5, 6, 7].map((n) => other(n))}
        onOpenDevice={(d) => calls.push(d.id)}
      />,
    );
    const nav = screen.getByRole('navigation', { name: de.header.otherDevicesLabel });
    expect(nav).toHaveTextContent(de.header.otherDevices('Jonas Weber'));
    const buttons = within(nav).getAllByRole('button');
    expect(buttons).toHaveLength(5);
    expect(buttons[0]).toHaveAccessibleName(de.header.openOtherDevice('CONTOSO-IP01', 'Konform'));
    await user.click(buttons[1]!);
    expect(calls).toEqual(['other-2']);
  });

  it('entfällt still ohne weitere Geräte, ohne Handler oder ohne Daten', () => {
    const { rerender } = render(
      <DeviceHeader
        device={named}
        summary={null}
        totalTiles={9}
        otherDevices={[]}
        onOpenDevice={() => {}}
      />,
    );
    expect(screen.queryByTestId('other-devices')).toBeNull();
    rerender(
      <DeviceHeader device={named} summary={null} totalTiles={9} otherDevices={[other(1)]} />,
    );
    expect(screen.queryByTestId('other-devices')).toBeNull();
    rerender(<DeviceHeader device={named} summary={null} totalTiles={9} onOpenDevice={() => {}} />);
    expect(screen.queryByTestId('other-devices')).toBeNull();
  });
});
