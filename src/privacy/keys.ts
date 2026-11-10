/**
 * Welche Felder der Daten sensibel sind – die einzige Stelle, an der der Präsentationsmodus Feldnamen
 * kennt. `collectKnown` (collect.ts) sammelt daraus die Werte einer Ansicht; Anzeige-Modelle werden dann
 * tief maskiert. Ein neues Feld mit personen- oder gerätebezogenem Inhalt = eine Zeile hier.
 *
 * Absicherung: Ein Test läuft über alle Demo-Daten und schlägt fehl, wenn ein verdächtig benanntes Feld
 * weder hier noch in VISIBLE_KEYS eingeordnet ist – neue Felder fallen so nicht unbemerkt durch.
 */
import type { SensitiveKind } from './masker';

/** Schlüssel (klein geschrieben) → Art des Werts. */
export const SENSITIVE_KEYS: Readonly<Record<string, SensitiveKind>> = {
  // Geräte
  devicename: 'device',
  devicedisplayname: 'device',
  computername: 'device',
  hostname: 'device',
  devicenamefromfile: 'device',
  // Benutzer
  userdisplayname: 'user',
  username: 'user',
  // UPN / E-Mail
  userprincipalname: 'upn',
  upn: 'upn',
  mail: 'upn',
  email: 'upn',
  emailaddress: 'upn',
  // Seriennummern und Gerätekennungen
  serialnumber: 'serial',
  imei: 'imei',
  meid: 'imei',
  macaddress: 'mac',
  wifimacaddress: 'mac',
  ethernetmacaddress: 'mac',
  phonenumber: 'phone',
  ipaddress: 'ip',
  // Objekt-IDs
  userid: 'id',
  azureaddeviceid: 'id',
  objectid: 'id',
  deviceid: 'id',
  tenantid: 'id',
  manageddeviceid: 'id',
  entradeviceid: 'id',
  azureaduserid: 'id',
  filtereduserid: 'id',
};

/**
 * Felder, die bewusst sichtbar bleiben (Diagnose) oder nur Metadaten sind. Wird ausschließlich vom
 * Abdeckungstest gelesen; hier steht, was ein verdächtig benanntes Feld ist, aber kein Personenbezug.
 */
export const VISIBLE_KEYS: readonly string[] = [
  // Richtlinien-, Gruppen- und App-Namen
  'displayname',
  'instancedisplayname',
  'settingname',
  'appdisplayname',
  'resourcedisplayname',
  'enrollmentprofilename',
  'organizationname',
  // Hardware/Software
  'manufacturer',
  'model',
  'devicemodel',
  'operatingsystem',
  'osversion',
  'operatingsystemversion',
  // IDs von Richtlinien, Gruppen, Apps, Schlüsseln, Vorgängen (kein Personenbezug; GUIDs fängt das Netz trotzdem)
  'id',
  'groupid',
  'appid',
  'correlationid',
  'requestid',
  // Defender-Risikostufe des Geräts (Wert, kein Name)
  'deviceriskscore',
];
