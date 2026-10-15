import type { DeviceSnapshot, SectionResult, SnapshotSectionKey, Tile } from '../domain/types';
import { de } from '../i18n/de';

export interface SectionNotice {
  key: SnapshotSectionKey;
  status: Exclude<SectionResult<unknown>['status'], 'ok'>;
  title: string;
  message: string;
  requiredScope?: string;
  sourceLabel: string;
}

/** Nicht-ok-Sections, von denen eine Kachel abhängt – für die Hinweise im Detail-Sheet. */
export function sectionNotices(snapshot: DeviceSnapshot, tile: Tile): SectionNotice[] {
  const notices: SectionNotice[] = [];
  for (const key of tile.sections) {
    const result = snapshot[key] as SectionResult<unknown> | undefined;
    if (!result || result.status === 'ok') continue;
    const base = { key, status: result.status, sourceLabel: result.source.label };
    switch (result.status) {
      case 'forbidden':
        notices.push({
          ...base,
          title: de.availability.forbidden,
          message: result.error.message,
          requiredScope: result.error.requiredScope,
        });
        break;
      case 'error':
        notices.push({ ...base, title: de.states.error, message: result.error.message });
        break;
      case 'notApplicable':
        notices.push({ ...base, title: de.states.notApplicable, message: result.reason });
        break;
      case 'unavailable':
        notices.push({ ...base, title: de.states.unavailable, message: result.reason });
        break;
    }
  }
  return notices;
}
