import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ManagedDeviceInfo } from '../domain/types';
import { de } from '../i18n/de';
import { IntunePortal } from '../links/intunePortal';
import { DeviceHeader } from './DeviceHeader';

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
  source: { kind: 'mock', label: 'GET /deviceManagement/managedDevices/{id}' },
};

describe('DeviceHeader', () => {
  it('verlinkt Gerät und Managed Apps im Intune Admin Center (neuer Tab, tastaturbedienbar)', async () => {
    const user = userEvent.setup();
    render(<DeviceHeader device={device} summary={null} totalTiles={0} />);

    const deviceLink = screen.getByRole('link', { name: de.links.openDevice });
    const appsLink = screen.getByRole('link', { name: de.links.openManagedApps });
    expect(deviceLink).toHaveAttribute('href', IntunePortal.device('dev-0001'));
    expect(appsLink).toHaveAttribute('href', IntunePortal.deviceManagedApps('dev-0001'));
    for (const link of [deviceLink, appsLink]) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }

    await user.tab();
    expect(deviceLink).toHaveFocus();
    await user.tab();
    expect(appsLink).toHaveFocus();
  });

  it('zeigt ohne Gerät keine Portal-Links', () => {
    render(<DeviceHeader device={null} summary={null} totalTiles={0} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
