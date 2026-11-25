import { describe, expect, it } from 'vitest';
import { buildSearch, parseUrl } from './useUrlState';

describe('URL-State', () => {
  it('liest und schreibt die Geräteansicht mit Kachel', () => {
    const state = parseUrl('?device=abc&mode=live&tile=defender');
    expect(state).toMatchObject({ device: 'abc', mode: 'live', tile: 'defender', view: null });
    expect(buildSearch(state)).toBe('?device=abc&mode=live&tile=defender');
  });

  it('liest und schreibt die Ansicht „Mandant“ (ohne Gerät)', () => {
    const state = parseUrl('?view=tenant&mode=demo&tile=tenantVpp');
    expect(state).toMatchObject({ device: null, view: 'tenant', tile: 'tenantVpp' });
    expect(buildSearch(state)).toBe('?view=tenant&mode=demo&tile=tenantVpp');
  });

  it('liest und schreibt den Verbindungstest eines Geräts (ohne Kachel)', () => {
    const state = parseUrl('?device=abc&view=connection-test&mode=live');
    expect(state).toMatchObject({ device: 'abc', view: 'connectionTest', mode: 'live' });
    expect(buildSearch(state)).toBe('?device=abc&view=connection-test&mode=live');
    expect(buildSearch({ ...state, tile: 'defender' })).not.toContain('tile=');
  });

  it('schreibt den Verbindungstest nicht ohne Gerät und ignoriert unbekannte Ansichten', () => {
    expect(buildSearch({ device: null, tile: null, mode: 'live', view: 'connectionTest' })).toBe(
      '?mode=live',
    );
    expect(parseUrl('?view=unbekannt').view).toBeNull();
  });
});

describe('URL-State: Ansicht „Empfehlungen“', () => {
  it('liest und schreibt view, level (nur ≠ Standard) und Kachel', () => {
    const state = parseUrl('?view=recommendations&level=3&mode=demo&tile=postureAppProtectionIos');
    expect(state).toMatchObject({
      device: null,
      view: 'recommendations',
      level: 3,
      tile: 'postureAppProtectionIos',
    });
    expect(buildSearch(state)).toBe(
      '?view=recommendations&level=3&mode=demo&tile=postureAppProtectionIos',
    );
  });

  it('lässt die Standardstufe weg und ignoriert ungültige Stufen', () => {
    expect(
      buildSearch({ device: null, tile: null, mode: null, view: 'recommendations', level: 2 }),
    ).toBe('?view=recommendations');
    expect(parseUrl('?view=recommendations&level=7').level).toBeNull();
    expect(parseUrl('?view=recommendations&level=abc').level).toBeNull();
  });

  it('schreibt level nur in der Ansicht „Empfehlungen“', () => {
    expect(buildSearch({ device: null, tile: null, mode: null, view: 'tenant', level: 3 })).toBe(
      '?view=tenant',
    );
    expect(buildSearch({ device: 'abc', tile: null, mode: null, level: 3 })).toBe('?device=abc');
  });
});

describe('URL-State: Ansicht „Flotte“', () => {
  it('liest und schreibt view, issue und platform', () => {
    const state = parseUrl('?view=fleet&issue=notEncrypted&platform=macos&mode=demo');
    expect(state).toMatchObject({
      device: null,
      view: 'fleet',
      issue: 'notEncrypted',
      platform: 'macos',
    });
    expect(buildSearch(state)).toBe('?view=fleet&issue=notEncrypted&platform=macos&mode=demo');
    expect(parseUrl('?view=fleet&issue=any').issue).toBe('any');
    expect(buildSearch({ device: null, tile: null, mode: null, view: 'fleet' })).toBe(
      '?view=fleet',
    );
  });

  it('ignoriert ungültige Werte', () => {
    const state = parseUrl('?view=fleet&issue=kaputt&platform=beos');
    expect(state.issue).toBeNull();
    expect(state.platform).toBeNull();
    expect(buildSearch(state)).toBe('?view=fleet');
  });

  it('schreibt die Filter nur in der Ansicht „Flotte“', () => {
    expect(
      buildSearch({ device: null, tile: null, mode: null, view: 'tenant', issue: 'any' }),
    ).toBe('?view=tenant');
    expect(
      buildSearch({ device: 'abc', tile: null, mode: null, view: 'fleet', platform: 'ios' }),
    ).toBe('?device=abc');
  });
});
