/** Gemeinsame Darstellung einzelner Richtlinien-Einstellungen (Compliance + Konfiguration). */
import type { PolicySettingInfo } from '../../domain/types';
import { de } from '../../i18n/de';

export function settingName(setting: PolicySettingInfo): string {
  return setting.settingName ?? setting.instanceDisplayName ?? setting.setting ?? '–';
}

export function settingLabel(setting: PolicySettingInfo): string {
  return de.rules.compliance.settingLine(settingName(setting), setting.currentValue);
}
