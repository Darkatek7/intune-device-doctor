import { describe, expect, it } from 'vitest';
import { DEFAULT_IDLE_TIMEOUT_MINUTES, parseIdleTimeoutMinutes } from './config';

describe('parseIdleTimeoutMinutes', () => {
  it('nutzt ohne Angabe den Standard (30 Minuten)', () => {
    expect(DEFAULT_IDLE_TIMEOUT_MINUTES).toBe(30);
    expect(parseIdleTimeoutMinutes(undefined)).toBe(30);
    expect(parseIdleTimeoutMinutes('')).toBe(30);
    expect(parseIdleTimeoutMinutes('   ')).toBe(30);
  });

  it('übernimmt ganze Minuten; 0 schaltet ab', () => {
    expect(parseIdleTimeoutMinutes('15')).toBe(15);
    expect(parseIdleTimeoutMinutes(' 5 ')).toBe(5);
    expect(parseIdleTimeoutMinutes('1440')).toBe(1440);
    expect(parseIdleTimeoutMinutes('0')).toBe(0);
  });

  it('fällt bei ungültigen Werten auf den Standard zurück', () => {
    for (const bad of ['abc', '-5', '1.5', '10min', '1e3', '1441', '99999', 'NaN', 'Infinity']) {
      expect(parseIdleTimeoutMinutes(bad), bad).toBe(30);
    }
  });
});
