import { describe, expect, it } from 'vitest';
import { collectKnown } from './collect';
import { createMasker, PSEUDONYM_DOMAIN } from './masker';
import { createView } from './view';

const m = createMasker('salt-a');

describe('Pseudonyme', () => {
  it('sind stabil und unterscheiden sich je Wert und Salt', () => {
    expect(m.device('CONTOSO-PC042')).toBe(m.device('CONTOSO-PC042'));
    expect(m.device('contoso-pc042')).toBe(m.device('CONTOSO-PC042'));
    expect(m.device('CONTOSO-PC042')).not.toBe(m.device('CONTOSO-PC043'));
    expect(createMasker('salt-b').device('CONTOSO-PC042')).not.toBe(m.device('CONTOSO-PC042'));
    expect(m.device('CONTOSO-PC042')).toMatch(/^Gerät-[0-9A-F]{4}$/);
    expect(m.user('Max Mustermann')).toMatch(/^Benutzer-[0-9A-F]{4}$/);
    expect(m.serial('DEMO-000042')).toMatch(/^SN-[0-9A-F]{6}$/);
  });

  it('verraten den Originalwert nicht', () => {
    for (const value of ['CONTOSO-PC042', 'max.mustermann@contoso.com', 'DEMO-000042']) {
      const all = [m.device(value), m.upn(value), m.serial(value), m.user(value)].join(' ');
      expect(all.toLowerCase()).not.toContain(value.toLowerCase());
    }
  });

  it('UPN im UPN-Format mit fiktiver Domäne', () => {
    const pseudo = m.upn('Max.Mustermann@contoso.com');
    expect(pseudo).toMatch(new RegExp(`^benutzer-[0-9A-F]{4}@${PSEUDONYM_DOMAIN}$`));
    expect(m.upn('max.mustermann@other.org')).toBe(pseudo);
  });

  it('IDs gekürzt wie maskId, kurze Werte als ID-Pseudonym', () => {
    expect(m.id('12345678-90ab-cdef-1234-567890abcdef')).toBe('1234…cdef');
    expect(m.id('md-001')).toMatch(/^ID-[0-9A-F]{4}$/);
  });

  it('ist idempotent', () => {
    for (const pseudo of [
      m.device('A-DEVICE'),
      m.user('Anna Schmidt'),
      m.upn('anna@contoso.com'),
      m.serial('ABCD1234'),
      m.id('12345678-90ab-cdef-1234-567890abcdef'),
      m.fileName('DiagLogs-X.zip'),
      m.imei('356938035643809'),
      m.mac('00:11:22:33:44:55'),
      m.phone('+49 170 1234567'),
      m.ip('10.1.2.3'),
    ]) {
      expect(m.text(pseudo)).toBe(pseudo);
    }
    expect(m.device(m.device('A-DEVICE'))).toBe(m.device('A-DEVICE'));
    expect(m.fileName('DiagLogs-X.zip')).toMatch(/^Datei-[0-9A-F]{4}\.zip$/);
  });
});

describe('text – Sicherheitsnetz', () => {
  it('maskiert E-Mail-Adressen, GUIDs, MAC- und IP-Adressen', () => {
    const out = m.text(
      'Mail anna@contoso.com, Gerät 12345678-90ab-cdef-1234-567890abcdef, MAC 00-11-22-33-44-55, IP 192.168.10.7, IPv6 fe80:0:0:0:1:2:3:4',
    );
    expect(out).not.toContain('anna@contoso.com');
    expect(out).not.toContain('12345678-90ab-cdef-1234-567890abcdef');
    expect(out).not.toContain('00-11-22-33-44-55');
    expect(out).not.toContain('192.168.10.7');
    expect(out).not.toContain('fe80:0:0:0:1:2:3:4');
    expect(out).toContain('1234…cdef');
  });

  it('lässt Versionen und Zeiten unberührt', () => {
    const text =
      'Windows 10.0.22631.4317, Engine 1.1.24090.11, Agent-Version 1.101.103.0, v2.1.0.4, um 12:30:45, Build 10.0.1.2';
    expect(m.text(text)).toBe(text);
  });

  it('lässt Pseudonyme unverändert (zweimal anwenden)', () => {
    const once = m.text('anna@contoso.com und 10.0.0.5');
    expect(m.text(once)).toBe(once);
  });
});

describe('Scope – bekannte Werte', () => {
  const known = collectKnown({
    deviceName: 'CONTOSO-PC042',
    userPrincipalName: 'sophie.hartmann@contoso.com',
    userDisplayName: 'Sophie Hartmann',
    serialNumber: 'DEMO-000042',
  });
  const view = createView(m, true, known);

  it('ersetzt bekannte Werte im Freitext, unabhängig von der Schreibweise', () => {
    const out = view.text(
      'Gerät contoso-pc042 von Sophie Hartmann (sophie.hartmann), Seriennummer DEMO-000042.',
    );
    expect(out).not.toMatch(/contoso-pc042|Sophie|hartmann|DEMO-000042/i);
    expect(out).toContain(m.device('CONTOSO-PC042'));
    expect(out).toContain(m.user('Sophie Hartmann'));
    expect(out).toContain(m.serial('DEMO-000042'));
  });

  it('ersetzt nicht innerhalb längerer Wörter', () => {
    const v = createView(m, true, [{ kind: 'user', value: 'Max' }]);
    expect(v.text('Maximum und Max')).toBe(`Maximum und ${m.user('Max')}`);
  });

  it('bevorzugt den längeren Treffer', () => {
    const v = createView(m, true, [
      { kind: 'device', value: 'PC042' },
      { kind: 'device', value: 'CONTOSO-PC042' },
    ]);
    expect(v.text('CONTOSO-PC042')).toBe(m.device('CONTOSO-PC042'));
  });

  it('ist ausgeschaltet ein No-op', () => {
    const off = createView(m, false, known);
    const model = { a: 'CONTOSO-PC042', b: ['anna@contoso.com'] };
    expect(off.deep(model)).toBe(model);
    expect(off.text('CONTOSO-PC042')).toBe('CONTOSO-PC042');
  });
});

describe('deep', () => {
  it('maskiert alle Zeichenketten, lässt Zahlen, Links und Struktur', () => {
    const view = createView(m, true, [{ kind: 'device', value: 'CONTOSO-PC042' }]);
    const model = {
      id: 'tile-1',
      title: 'CONTOSO-PC042 ist offline',
      count: 3,
      flag: true,
      nothing: null,
      list: [{ detail: 'Mail a@b.de' }],
      links: [{ label: 'Öffnen', url: 'https://portal/#/device/CONTOSO-PC042' }],
    };
    const out = view.deep(model);
    expect(out.title).toBe(`${m.device('CONTOSO-PC042')} ist offline`);
    expect(out.count).toBe(3);
    expect(out.flag).toBe(true);
    expect(out.nothing).toBeNull();
    expect(out.list[0]?.detail).not.toContain('a@b.de');
    expect(out.links[0]?.url).toBe(model.links[0]?.url);
    expect(model.title).toBe('CONTOSO-PC042 ist offline');
  });
});

describe('collectKnown', () => {
  it('sammelt nach Feldnamen, auch verschachtelt und aus Listen', () => {
    const known = collectKnown({
      device: { id: 'md-1', deviceName: 'PC-1', serialNumber: 'SER123' },
      entra: { objectId: 'obj-1', displayName: 'PC-1-ENTRA' },
      policy: { id: 'pol-1', displayName: 'Contoso – Baseline' },
      rows: [{ userPrincipalName: 'a@b.de', userName: 'Anna Bauer' }],
      dsreg: { fields: [{ key: 'Device Name', value: 'HOST-9' }] },
    });
    const has = (kind: string, value: string) =>
      known.some((k) => k.kind === kind && k.value === value);
    expect(has('device', 'PC-1')).toBe(true);
    expect(has('id', 'md-1')).toBe(true);
    expect(has('serial', 'SER123')).toBe(true);
    expect(has('device', 'PC-1-ENTRA')).toBe(true);
    expect(has('upn', 'a@b.de')).toBe(true);
    expect(has('upnLocal', 'a')).toBe(true);
    expect(has('user', 'Anna Bauer')).toBe(true);
    expect(has('device', 'HOST-9')).toBe(true);
    // Richtliniennamen bleiben sichtbar
    expect(known.some((k) => k.value.includes('Baseline'))).toBe(false);
    expect(known.some((k) => k.value === 'pol-1')).toBe(false);
  });

  it('übersteht Zyklen', () => {
    const a: Record<string, unknown> = { deviceName: 'LOOP-1' };
    a['self'] = a;
    expect(collectKnown(a)).toEqual([{ kind: 'device', value: 'LOOP-1' }]);
  });
});
