import { describe, expect, it, vi } from 'vitest';
import {
  appBaseUrl,
  appDeviceUrl,
  buildBookmarklet,
  parseDeviceIdFromPortalUrl,
} from './bookmarklet';
import { IntunePortal } from './intunePortal';

const ID = '3f2a9c4e-1b7d-4e8a-9c55-0a1b2c3d4e5f';

describe('parseDeviceIdFromPortalUrl', () => {
  it('liest die ID aus den Direktlinks von intunePortal.ts', () => {
    expect(parseDeviceIdFromPortalUrl(IntunePortal.device(ID))).toBe(ID);
    expect(parseDeviceIdFromPortalUrl(IntunePortal.deviceManagedApps(ID))).toBe(ID);
    expect(parseDeviceIdFromPortalUrl(IntunePortal.deviceInventory(ID))).toBe(ID);
  });
  it('liefert die ID in Kleinschreibung', () => {
    expect(parseDeviceIdFromPortalUrl(`https://x/#/mdmDeviceId/${ID.toUpperCase()}`)).toBe(ID);
  });
  it.each([
    IntunePortal.allDevices,
    'https://intune.microsoft.com/#view/x/mdmDeviceId/nicht-eine-guid',
    'https://intune.microsoft.com/#view/x/appId/' + ID,
    '',
  ])('findet keine ID in %s', (href) => {
    expect(parseDeviceIdFromPortalUrl(href)).toBeNull();
  });
});

describe('appBaseUrl / appDeviceUrl', () => {
  it('hängt den Base-Pfad an die Origin', () => {
    expect(appBaseUrl('https://doctor.example', '/')).toBe('https://doctor.example/');
    expect(appBaseUrl('https://doctor.example', '/mdm-doctor')).toBe(
      'https://doctor.example/mdm-doctor/',
    );
  });
  it('baut den Live-Link', () => {
    expect(appDeviceUrl('https://doctor.example/', ID)).toBe(
      `https://doctor.example/?device=${ID}&mode=live`,
    );
  });
});

describe('buildBookmarklet', () => {
  const run = (
    href: string,
    appUrl = 'https://doctor.example/app/',
    message = "Keine ID, 100% 'sicher'",
  ) => {
    const code = buildBookmarklet(appUrl, message);
    const open = vi.fn();
    const alert = vi.fn();
    const body = code.replace(/^javascript:/, '');
    new Function('location', 'window', 'alert', body)({ href }, { open }, alert);
    return { code, open, alert };
  };

  it('beginnt mit javascript: und enthält weder % noch doppelte Anführungszeichen', () => {
    const { code } = run('https://intune.microsoft.com/');
    expect(code.startsWith('javascript:')).toBe(true);
    expect(code).not.toMatch(/[%"\n]/);
  });

  it('öffnet auf einer Geräteseite die App in neuem Tab', () => {
    const { open, alert } = run(IntunePortal.device(ID));
    expect(alert).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(
      `https://doctor.example/app/?device=${ID}&mode=live`,
      '_blank',
      'noopener',
    );
  });

  it('zeigt sonst die Meldung', () => {
    const { open, alert } = run(IntunePortal.allDevices);
    expect(open).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith("Keine ID, 100% 'sicher'");
  });
});
