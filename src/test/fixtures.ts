import type { Finding, Tile } from '../domain/types';

export function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'f1',
    severity: 'critical',
    title: 'BitLocker ist nicht aktiviert',
    detail: 'Das Laufwerk C: ist nicht verschlüsselt.',
    cause: 'Die Richtlinie wurde nicht angewendet.',
    remediation: ['Gerät synchronisieren lassen.', 'Richtlinienzuweisung prüfen.'],
    evidence: { isEncrypted: false, volume: 'C:' },
    source: {
      kind: 'mock',
      label: 'GET /deviceManagement/managedDevices/{id}',
      docsUrl: 'https://learn.microsoft.com/graph/api/intune-devices-manageddevice-get',
    },
    docsUrl: 'https://learn.microsoft.com/mem/intune/protect/encrypt-devices',
    ...overrides,
  };
}

export function makeTile(overrides: Partial<Tile> = {}): Tile {
  return {
    id: 'bitlocker',
    title: 'BitLocker',
    state: 'ready',
    severity: 'critical',
    value: 'Nicht aktiv',
    summary: 'Laufwerk C: unverschlüsselt',
    findings: [makeFinding()],
    sources: [{ kind: 'mock', label: 'GET /deviceManagement/managedDevices/{id}' }],
    facts: [{ label: 'Verschlüsselt', value: 'Nein' }],
    sections: ['bitlockerKeys'],
    ...overrides,
  };
}
