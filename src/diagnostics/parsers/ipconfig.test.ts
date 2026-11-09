import { describe, expect, it } from 'vitest';
import { maskMac, parseIpconfigAll } from './ipconfig';

const DE = `
Windows-IP-Konfiguration

   Hostname  . . . . . . . . . . . . : CONTOSO-PC042
   Primäres DNS-Suffix . . . . . . . : contoso.com
   Suchliste für DNS-Suffixe . . . . : contoso.com
                                       corp.contoso.com

Ethernet-Adapter Ethernet:

   Verbindungsspezifisches DNS-Suffix: contoso.com
   Beschreibung. . . . . . . . . . . : Contoso Virtual Ethernet
   Physische Adresse . . . . . . . . : 00-00-5E-00-53-42
   DHCP aktiviert. . . . . . . . . . : Ja
   IPv4-Adresse  . . . . . . . . . . : 192.0.2.42(Bevorzugt)
   Subnetzmaske  . . . . . . . . . . : 255.255.255.0
   DNS-Server  . . . . . . . . . . . : 192.0.2.53
                                       192.0.2.54

Drahtlos-LAN-Adapter WLAN:

   Medienstatus. . . . . . . . . . . : Medium getrennt
   Beschreibung. . . . . . . . . . . : Contoso Virtual WLAN
   DHCP aktiviert. . . . . . . . . . : Nein
`;

const EN = `
Windows IP Configuration

   Host Name . . . . . . . . . . . . : CONTOSO-PC042
   Primary Dns Suffix  . . . . . . . : contoso.com
   DNS Suffix Search List. . . . . . : contoso.com

Ethernet adapter Ethernet:

   Connection-specific DNS Suffix  . : contoso.com
   Description . . . . . . . . . . . : Contoso Virtual Ethernet
   Physical Address. . . . . . . . . : 00-00-5E-00-53-42
   DHCP Enabled. . . . . . . . . . . : Yes
   IPv4 Address. . . . . . . . . . . : 192.0.2.42(Preferred)
   IPv6 Address. . . . . . . . . . . : 2001:db8::42(Preferred)
   DNS Servers . . . . . . . . . . . : 192.0.2.53
                                       2001:db8::53
`;

describe('parseIpconfigAll', () => {
  it('liest deutsche Ausgabe: Adapter, IPv4, DNS, Suffixe; MAC maskiert', () => {
    const info = parseIpconfigAll(DE);
    expect(info.primaryDnsSuffix).toBe('contoso.com');
    expect(info.dnsSuffixSearchList).toEqual(['contoso.com', 'corp.contoso.com']);
    expect(info.adapters).toHaveLength(2);
    expect(info.adapters[0]).toEqual({
      name: 'Ethernet-Adapter Ethernet',
      description: 'Contoso Virtual Ethernet',
      macMasked: '00-00-5E-••-••-••',
      dhcpEnabled: true,
      mediaDisconnected: false,
      ipv4: ['192.0.2.42'],
      dnsServers: ['192.0.2.53', '192.0.2.54'],
      dnsSuffix: 'contoso.com',
    });
    expect(info.adapters[1]).toMatchObject({
      name: 'Drahtlos-LAN-Adapter WLAN',
      mediaDisconnected: true,
      dhcpEnabled: false,
      ipv4: [],
    });
    expect(JSON.stringify(info)).not.toContain('CONTOSO-PC042');
    expect(JSON.stringify(info)).not.toContain('53-42');
  });

  it('liest englische Ausgabe; IPv6-Adressen werden nicht als IPv4 übernommen', () => {
    const info = parseIpconfigAll(EN);
    expect(info.primaryDnsSuffix).toBe('contoso.com');
    expect(info.adapters[0]).toMatchObject({
      name: 'Ethernet adapter Ethernet',
      ipv4: ['192.0.2.42'],
      dnsServers: ['192.0.2.53', '2001:db8::53'],
      dhcpEnabled: true,
    });
  });

  it('verträgt leere und fremde Ausgaben', () => {
    expect(parseIpconfigAll('')).toEqual({
      primaryDnsSuffix: null,
      dnsSuffixSearchList: [],
      adapters: [],
    });
    expect(parseIpconfigAll('Irgendetwas ohne Adapter').adapters).toEqual([]);
  });
});

describe('maskMac', () => {
  it('behält nur das Herstellerpräfix', () => {
    expect(maskMac('00-00-5E-00-53-42')).toBe('00-00-5E-••-••-••');
    expect(maskMac('00:00:5e:00:53:42')).toBe('00-00-5e-••-••-••');
    expect(maskMac('kaputt')).toBe('••');
  });
});
