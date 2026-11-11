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
  // M20: Name einer Compliance-Einstellung bzw. einer Anwendung im Änderungsprotokoll (Benutzer-UPNs
  // desselben Felds sammelt collect.ts über `kind: 'user'`), Rohwerte von Microsoft
  'name',
  'actionname',
  'componentname',
];

/**
 * Generische Gerätenamen sind keine Kennung: Ab iOS 16 melden App-Schutz-Registrierungen laut Microsoft nur
 * noch „iPhone“ bzw. „iPad“. Als bekannter Wert würden sie zudem Modellbezeichnungen wie „iPhone 15“
 * verstümmeln – sie werden deshalb weder gesammelt noch gesucht.
 */
export const isGenericDeviceName = (value: string): boolean =>
  /^(iphone|ipad|ipod touch|android)$/i.test(value.trim());

/**
 * Objekt eines Eintrags im Änderungsprotokoll (M20): Ist sein Anzeigename eine Kennung? `auditResource.type`
 * ist eine freie Zeichenkette ohne dokumentierte Werteliste – deshalb eine vorsichtige Heuristik: Typen, die
 * nach Richtlinie, Profil, App, Gruppe oder Rolle klingen, bleiben sichtbar (wie überall im Modus); Typen,
 * die nach Gerät oder Benutzer klingen, werden verborgen.
 */
const AUDIT_TYPE_VISIBLE =
  /polic|configuration|compliance|profile|categor|script|setting|assignment|filter|template|baseline|restriction|notification|app|group|role|scope|tag|term|brand/i;

export function auditResourceKind(type: unknown): 'device' | 'user' | null {
  if (typeof type !== 'string' || AUDIT_TYPE_VISIBLE.test(type)) return null;
  if (/device|autopilot|computer/i.test(type)) return 'device';
  if (/user|account|person/i.test(type)) return 'user';
  return null;
}
