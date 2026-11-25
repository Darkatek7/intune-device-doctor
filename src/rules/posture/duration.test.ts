/** M21/S2: ISO-8601-Dauern aus Graph. */
import { describe, expect, it } from 'vitest';
import { formatDurationMinutes, parseIsoDurationMinutes } from './duration';

describe('parseIsoDurationMinutes', () => {
  it.each([
    ['PT30M', 30],
    ['PT10080M', 10080],
    ['P7D', 10080],
    ['P90D', 129600],
    ['PT12H', 720],
    ['P1DT12H', 2160],
    ['P1W', 10080],
    ['PT90S', 1.5],
    ['PT0S', 0],
    ['pt30m', 30],
  ])('%s → %d Minuten', (input, minutes) => {
    expect(parseIsoDurationMinutes(input)).toBe(minutes);
  });

  it.each([null, undefined, '', 'P', 'PT', '30', 'P1Y', 'P1M', 'PXD', 'P1DT'])(
    '%s → null',
    (input) => {
      expect(parseIsoDurationMinutes(input)).toBeNull();
    },
  );
});

describe('formatDurationMinutes', () => {
  it('wählt die größte glatte Einheit', () => {
    expect(formatDurationMinutes(30)).toBe('30 Minuten');
    expect(formatDurationMinutes(60)).toBe('1 Stunde');
    expect(formatDurationMinutes(10080)).toBe('7 Tage');
    expect(formatDurationMinutes(1440)).toBe('1 Tag');
    expect(formatDurationMinutes(45)).toBe('45 Minuten');
  });
});
