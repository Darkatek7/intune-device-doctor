import { describe, expect, it } from 'vitest';
import { parseCertDate, parseCertutilStore } from './certutil';

const DE = `My "Eigene Zertifikate"
================ Zertifikat 0 ================
Seriennummer: 0a1b2c3d4e5f6071
Aussteller: CN=MS-Organization-Access
 NotBefore: 01.01.2026 08:00
 NotAfter: 01.01.2036 08:00
Antragsteller: CN=00000000-0000-0000-0000-000000000042
Kein Stammzertifikat

================ Zertifikat 1 ================
Seriennummer: 11 22 33 44 55 66 77 88
Aussteller: CN=Contoso Geräte-CA, O=Contoso
 NotBefore: 01.10.2025 08:00
 NotAfter: 01.10.2026 08:00
Antragsteller: CN=Büro-Gerät-042, O=Contoso

CertUtil: -store-Befehl wurde erfolgreich ausgeführt.
`;

const EN = `My "Personal"
================ Certificate 0 ================
Serial Number: 99aabbccddeeff00
Issuer: CN=Contoso Device CA, O=Contoso
 NotBefore: 10/30/2025 8:00 AM
 NotAfter: 10/30/2026 8:00 PM
Subject: CN=CONTOSO-PC042, O=Contoso
Non-root Certificate
Cert Hash(sha1): 00 00 00
`;

describe('parseCertutilStore', () => {
  it('liest deutsche Ausgabe: Aussteller, NotAfter, maskierter Antragsteller/Seriennummer', () => {
    const certs = parseCertutilStore(DE);
    expect(certs).toHaveLength(2);
    expect(certs[0]).toMatchObject({
      store: 'My "Eigene Zertifikate"',
      issuer: 'CN=MS-Organization-Access',
      notBefore: '2026-01-01T08:00:00Z',
      notAfter: '2036-01-01T08:00:00Z',
      notAfterRaw: '01.01.2036 08:00',
      serialMasked: '0a1b…6071',
      subjectMasked: 'CN=0000…0042',
    });
    expect(certs[1]?.issuer).toBe('CN=Contoso Geräte-CA, O=Contoso');
    expect(certs[1]?.serialMasked).toBe('1122…7788');
    expect(certs[1]?.subjectMasked).toBe('CN=Büro…-042, O=Contoso');
    expect(certs[1]?.notAfter).toBe('2026-10-01T08:00:00Z');
  });

  it('liest englische Ausgabe (M/d/yyyy h:mm AM/PM)', () => {
    const [cert] = parseCertutilStore(EN);
    expect(cert).toMatchObject({
      issuer: 'CN=Contoso Device CA, O=Contoso',
      notBefore: '2025-10-30T08:00:00Z',
      notAfter: '2026-10-30T20:00:00Z',
      subjectMasked: 'CN=CONT…C042, O=Contoso',
    });
    expect(JSON.stringify(cert)).not.toContain('CONTOSO-PC042');
  });

  it('zeigt Antragsteller in CA-Speichern unmaskiert, maskiert aber GUIDs und E-Mail-Adressen', () => {
    const text = `Root "Vertrauenswürdige Stammzertifizierungsstellen"
================ Zertifikat 0 ================
Seriennummer: 01
Aussteller: CN=Contoso Root CA
 NotAfter: 01.01.2040 00:00
Antragsteller: CN=Contoso Root CA
================ Zertifikat 1 ================
Seriennummer: 02
Aussteller: CN=Contoso Root CA
 NotAfter: 01.01.2040 00:00
Antragsteller: E=max@contoso.com, CN=00000000-0000-0000-0000-000000000099
`;
    const certs = parseCertutilStore(text);
    expect(certs[0]?.subjectMasked).toBe('CN=Contoso Root CA');
    expect(certs[1]?.subjectMasked).toBe('E=ma…@contoso.com, CN=0000…0099');
  });

  it('behält den Rohwert, wenn das Datum nicht lesbar ist', () => {
    const [cert] = parseCertutilStore(
      '================ Certificate 0 ================\nNotAfter: demnächst\nIssuer: CN=X\n',
    );
    expect(cert).toMatchObject({ notAfter: null, notAfterRaw: 'demnächst', issuer: 'CN=X' });
  });

  it('liefert bei fremder Ausgabe eine leere Liste und überspringt Leeres', () => {
    expect(parseCertutilStore('')).toEqual([]);
    expect(parseCertutilStore('Irgendein Text\nohne Zertifikate')).toEqual([]);
  });

  it('nimmt je Feld die erste Fundstelle (ausführliche Ausgabe)', () => {
    const [cert] = parseCertutilStore(
      '================ Certificate 0 ================\nIssuer: CN=Erste\nNotAfter: 01.01.2030 00:00\nIssuer: CN=Zweite\n',
    );
    expect(cert?.issuer).toBe('CN=Erste');
  });
});

describe('parseCertDate', () => {
  it('versteht deutsche, englische und ISO-Formate', () => {
    expect(parseCertDate('31.12.2026 23:59:58')).toBe('2026-12-31T23:59:58Z');
    expect(parseCertDate('12/31/2026 11:59 PM')).toBe('2026-12-31T23:59:00Z');
    expect(parseCertDate('12/1/2026 12:00 AM')).toBe('2026-12-01T00:00:00Z');
    expect(parseCertDate('31/12/2026 10:00')).toBe('2026-12-31T10:00:00Z');
    expect(parseCertDate('2026-12-31 10:00:00')).toBe('2026-12-31T10:00:00Z');
    expect(parseCertDate('2026-12-31')).toBe('2026-12-31T00:00:00Z');
  });

  it('lehnt Unsinn ab', () => {
    expect(parseCertDate('')).toBeNull();
    expect(parseCertDate('32.13.2026')).toBeNull();
    expect(parseCertDate('nie')).toBeNull();
  });
});
