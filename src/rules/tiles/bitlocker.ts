/**
 * BitLocker (Windows) bzw. FileVault (macOS) bzw. Verschlüsselung (sonstige):
 * isEncrypted aus managedDevice + (Windows) Wiederherstellungsschlüssel-Metadaten in Entra.
 * Schlüsselwerte werden nie gelesen.
 */
import type { DeviceSnapshot, Finding, Severity, Tile, TileFact } from '../../domain/types';
import { de } from '../../i18n/de';
import {
  availabilityOf,
  loadingTile,
  sectionIssueFinding,
  sectionsLoaded,
  sortFindings,
  summaryForIssue,
  uniqueSources,
} from '../helpers';
import { Docs } from '../knowledge/docs';

const t = de.rules.bitlocker;
const f = de.rules.facts;

export function evaluateBitLocker(snapshot: DeviceSnapshot, _now: Date): Tile {
  void _now;
  const sections: Tile['sections'] = ['bitlockerKeys'];
  const { device } = snapshot;
  const isWindows = device.osFamily === 'windows';
  const isMac = device.osFamily === 'macos';
  const title = isWindows ? de.tiles.bitlocker : isMac ? t.titleFileVault : t.titleEncryption;
  if (!sectionsLoaded(snapshot, sections)) return { ...loadingTile('bitlocker', sections), title };
  const keys = snapshot.bitlockerKeys!;
  const findings: Finding[] = [];
  const facts: TileFact[] = [];
  const encrypted = device.isEncrypted;

  facts.push({
    label: f.encryption,
    value:
      encrypted === true
        ? t.valueEncrypted
        : encrypted === false
          ? t.valueNotEncrypted
          : t.valueUnknown,
  });

  let severity: Severity;
  if (encrypted === false) {
    severity = 'critical';
    findings.push({
      id: 'bitlocker-notEncrypted',
      severity,
      title: t.notEncryptedTitle(title),
      detail: t.notEncryptedDetail,
      cause: isMac ? t.notEncryptedCauseMac : t.notEncryptedCauseWindows,
      remediation: isMac
        ? [...t.notEncryptedRemediationMac]
        : [...t.notEncryptedRemediationWindows],
      evidence: { isEncrypted: encrypted, operatingSystem: device.operatingSystem },
      source: device.source,
      docsUrl: isMac ? Docs.fileVault : Docs.encryptionMonitor,
    });
  } else if (encrypted === null) {
    severity = 'unknown';
    findings.push({
      id: 'bitlocker-unknown',
      severity,
      title: t.unknownTitle,
      detail: t.unknownDetail,
      cause: t.unknownCause,
      remediation: [...t.unknownRemediation],
      evidence: { isEncrypted: null },
      source: device.source,
      docsUrl: Docs.encryptionMonitor,
    });
  } else {
    severity = 'ok';
  }

  let summary: string = t.summaryPlatform;
  if (isWindows) {
    if (keys.status === 'ok') {
      const osKeys = keys.data.filter((k) => k.volumeType === 'operatingSystemVolume');
      const otherKeys = keys.data.length - osKeys.length;
      facts.push({ label: f.recoveryKeys, value: t.keysCount(osKeys.length, otherKeys) });
      if (osKeys.length > 0) {
        summary = t.summaryKeyEscrowed;
      } else {
        summary = t.summaryNoKey;
        if (encrypted === true) {
          severity = 'warning';
          findings.push({
            id: 'bitlocker-noKey',
            severity: 'warning',
            title: t.noKeyTitle,
            detail: t.noKeyDetail,
            cause: t.noKeyCause,
            remediation: [...t.noKeyRemediation],
            evidence: {
              isEncrypted: encrypted,
              recoveryKeysTotal: keys.data.length,
              osVolumeKeys: 0,
              azureADDeviceId: device.azureADDeviceId,
            },
            source: keys.source,
            docsUrl: Docs.viewRecoveryKeys,
          });
        }
      }
    } else {
      findings.push(sectionIssueFinding('bitlocker-keys', keys));
      summary = summaryForIssue(keys);
    }
  }

  return {
    id: 'bitlocker',
    title,
    state: 'ready',
    severity,
    value:
      encrypted === true
        ? t.valueEncrypted
        : encrypted === false
          ? t.valueNotEncrypted
          : t.valueUnknown,
    summary,
    findings: sortFindings(findings),
    sources: uniqueSources([device.source, isWindows ? keys.source : undefined]),
    facts,
    // Für Nicht-Windows ist das Fehlen der BitLocker-Schlüssel erwartet → kein Verfügbarkeitshinweis
    availability: isWindows ? availabilityOf(keys) : undefined,
    sections,
  };
}
