import { describe, expect, it } from 'vitest';
import {
  MAX_MDMDIAG_CHILD_NAMES,
  MAX_MDMDIAG_CONDITIONS,
  MAX_MDMDIAG_SECTIONS,
  summarizeMdmDiagReport,
} from './mdmDiagReport';

/** Fiktives, an die Learn-Beschreibung angelehntes Beispiel (nur Multivariant ist dort belegt). */
const SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<MDMEnterpriseDiagnosticsReport>
  <Enrollment><Id>00000000-0000-0000-0000-000000000001</Id><Upn>user@contoso.com</Upn></Enrollment>
  <Enrollment><Id>00000000-0000-0000-0000-000000000002</Id></Enrollment>
  <ProvisioningPackages>
    <Package Id="pkg1">
      <Multivariant Condition="Pattern:.*Contoso.*" />
      <Multivariant><Condition Name="Lang" Value="de" /></Multivariant>
    </Package>
  </ProvisioningPackages>
</MDMEnterpriseDiagnosticsReport>`;

describe('summarizeMdmDiagReport', () => {
  it('fasst Aufbau und Multivariant-Bedingungen zusammen', () => {
    const summary = summarizeMdmDiagReport(SAMPLE)!;
    expect(summary.rootElement).toBe('MDMEnterpriseDiagnosticsReport');
    expect(summary.truncated).toBe(false);
    expect(summary.sections).toEqual([
      { name: 'Enrollment', count: 2, childNames: ['Id', 'Upn'] },
      { name: 'ProvisioningPackages', count: 1, childNames: ['Package'] },
    ]);
    // Attribut- und Kindelement-Form (Select -ExpandProperty Condition liest beide)
    expect(summary.multivariant).toEqual(['Pattern:.*Contoso.*', 'Name=Lang Value=de']);
    expect(summary.multivariantTotal).toBe(2);
  });

  it('gibt nur Namen und Bedingungen aus – keine Elementwerte (UPN, ID)', () => {
    const json = JSON.stringify(summarizeMdmDiagReport(SAMPLE));
    expect(json).not.toContain('contoso.com');
    expect(json).not.toContain('00000000-0000');
  });

  it('wendet die Maskierung auf Namen und Bedingungen an', () => {
    const masked = summarizeMdmDiagReport(
      '<R><Sec><X/></Sec><M Condition="user@contoso.com"/></R>',
      { mask: (key, value) => `${key}:${value.toUpperCase()}` },
    )!;
    expect(masked.rootElement).toBe('Name:R');
    expect(masked.sections[0]?.name).toBe('Name:SEC');
    expect(masked.sections[0]?.childNames).toEqual(['Name:X']);
    expect(masked.sections[1]?.name).toBe('Name:M');
  });

  it('unbekannte Struktur → Rohdaten-Aufbau statt Fehler; kein XML → null', () => {
    const summary = summarizeMdmDiagReport('<Anything><A/><B/></Anything>')!;
    expect(summary.multivariant).toEqual([]);
    expect(summary.multivariantTotal).toBe(0);
    expect(summary.sections.map((s) => s.name)).toEqual(['A', 'B']);
    expect(summarizeMdmDiagReport('')).toBeNull();
    expect(summarizeMdmDiagReport('{"json": true}')).toBeNull();
  });

  it('Grenzen: Abschnitte, Kindnamen und Bedingungen', () => {
    const sections = Array.from({ length: MAX_MDMDIAG_SECTIONS + 5 }, (_, i) => `<S${i}/>`).join(
      '',
    );
    const withSections = summarizeMdmDiagReport(`<R>${sections}</R>`)!;
    expect(withSections.sections).toHaveLength(MAX_MDMDIAG_SECTIONS);
    expect(withSections.sectionsTruncated).toBe(true);

    const kids = Array.from({ length: MAX_MDMDIAG_CHILD_NAMES + 4 }, (_, i) => `<K${i}/>`).join('');
    expect(summarizeMdmDiagReport(`<R><S>${kids}</S></R>`)!.sections[0]?.childNames).toHaveLength(
      MAX_MDMDIAG_CHILD_NAMES,
    );

    const conditions = Array.from(
      { length: MAX_MDMDIAG_CONDITIONS + 7 },
      (_, i) => `<Multivariant Condition="c${i}"/>`,
    ).join('');
    const withConditions = summarizeMdmDiagReport(`<R>${conditions}</R>`)!;
    expect(withConditions.multivariant).toHaveLength(MAX_MDMDIAG_CONDITIONS);
    expect(withConditions.multivariantTotal).toBe(MAX_MDMDIAG_CONDITIONS + 7);
  });

  it('meldet gekappte Dokumente', () => {
    const big = `<R>${'<A><B/></A>'.repeat(10)}</R>`;
    // Standardgrenze ist hoch; ein sehr tief verschachteltes Dokument erreicht die Tiefengrenze
    const deep = summarizeMdmDiagReport(`${'<A>'.repeat(200)}`)!;
    expect(deep.truncated).toBe(true);
    expect(summarizeMdmDiagReport(big)!.truncated).toBe(false);
  });
});
