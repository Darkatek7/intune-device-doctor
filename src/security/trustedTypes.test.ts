import { describe, expect, it, vi } from 'vitest';
import {
  installDefaultTrustedTypesPolicy,
  sameOriginScriptUrl,
  type TrustedTypePolicyFactoryLike,
} from './trustedTypes';

const ORIGIN = 'https://doctor.contoso.com';
const BASE = 'https://doctor.contoso.com/app/';

describe('sameOriginScriptUrl', () => {
  it('lässt Skript-URLs der eigenen Origin durch (absolut, relativ, blob:)', () => {
    expect(sameOriginScriptUrl('/assets/worker.js', ORIGIN, BASE)).toBe('/assets/worker.js');
    expect(sameOriginScriptUrl('worker.js', ORIGIN, BASE)).toBe('worker.js');
    expect(sameOriginScriptUrl(`${ORIGIN}/assets/w.js`, ORIGIN, BASE)).toBe(
      `${ORIGIN}/assets/w.js`,
    );
    const blob = `blob:${ORIGIN}/1b2c3d`;
    expect(sameOriginScriptUrl(blob, ORIGIN, BASE)).toBe(blob);
  });

  it('lehnt fremde Origins, data:, javascript: und Unparsebares ab', () => {
    expect(sameOriginScriptUrl('https://evil.example/w.js', ORIGIN, BASE)).toBeNull();
    expect(sameOriginScriptUrl('http://doctor.contoso.com/w.js', ORIGIN, BASE)).toBeNull();
    expect(sameOriginScriptUrl('blob:https://evil.example/1b2c', ORIGIN, BASE)).toBeNull();
    expect(sameOriginScriptUrl('data:text/javascript,1', ORIGIN, BASE)).toBeNull();
    expect(sameOriginScriptUrl('javascript:alert(1)', ORIGIN, BASE)).toBeNull();
    expect(sameOriginScriptUrl('http://[', ORIGIN, BASE)).toBeNull();
  });
});

describe('installDefaultTrustedTypesPolicy', () => {
  it('legt die Policy „default“ an: HTML und Skript abgelehnt, Skript-URL nur same-origin', () => {
    const createPolicy = vi.fn();
    const factory: TrustedTypePolicyFactoryLike = { createPolicy };
    expect(installDefaultTrustedTypesPolicy(factory, ORIGIN, BASE)).toBe(true);

    const [name, rules] = createPolicy.mock.calls[0] as [
      string,
      Required<Parameters<TrustedTypePolicyFactoryLike['createPolicy']>[1]>,
    ];
    expect(name).toBe('default');
    expect(rules.createHTML('<img src=x onerror=alert(1)>')).toBeNull();
    expect(rules.createScript('alert(1)')).toBeNull();
    expect(rules.createScriptURL('/assets/worker.js')).toBe('/assets/worker.js');
    expect(rules.createScriptURL('https://evil.example/w.js')).toBeNull();
  });

  it('tut nichts ohne Trusted-Types-Unterstützung oder bei vorhandener Default-Policy', () => {
    expect(installDefaultTrustedTypesPolicy(undefined, ORIGIN, BASE)).toBe(false);
    const createPolicy = vi.fn();
    expect(
      installDefaultTrustedTypesPolicy({ defaultPolicy: {}, createPolicy }, ORIGIN, BASE),
    ).toBe(false);
    expect(createPolicy).not.toHaveBeenCalled();
  });

  it('fängt einen Fehler von createPolicy ab (z. B. trusted-types-Liste ohne „default“)', () => {
    const createPolicy = vi.fn(() => {
      throw new TypeError('Policy with name "default" disallowed.');
    });
    expect(installDefaultTrustedTypesPolicy({ createPolicy }, ORIGIN, BASE)).toBe(false);
  });
});
