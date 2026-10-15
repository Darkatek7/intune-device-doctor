import { describe, expect, it } from 'vitest';
import { parseCmTrace } from './cmtrace';

const line = (type: number, message: string, time = '12:50:45.2233445'): string =>
  `<![LOG[${message}]LOG]!><time="${time}" date="10-14-2026" component="IME" context="" type="${type}" thread="7" file="">\r\n`;

describe('parseCmTrace', () => {
  const text = [
    line(1, 'info'),
    line(2, 'warn'),
    line(3, 'multi\r\nline stack'),
    line(3, 'contact user@contoso.com'),
  ].join('');

  it('parst alle Einträge inkl. mehrzeiliger', () => {
    const all = parseCmTrace(text, 'a.log');
    expect(all.map((e) => e.type)).toEqual([1, 2, 3, 3]);
    expect(all[2]?.message).toBe('multi\nline stack');
    expect(all[0]).toMatchObject({
      file: 'a.log',
      component: 'IME',
      thread: 7,
      timestamp: '2026-10-14T12:50:45.223',
    });
  });

  it('filtert auf Warnungen und Fehler', () => {
    expect(parseCmTrace(text, 'a.log', { onlyIssues: true }).map((e) => e.type)).toEqual([2, 3, 3]);
  });

  it('behält bei Überschreitung des Limits die jüngsten Einträge', () => {
    const limited = parseCmTrace(text, 'a.log', { onlyIssues: true, limit: 2 });
    expect(limited).toHaveLength(2);
    expect(limited[0]?.message).toContain('multi');
  });

  it('maskiert UPNs in Nachrichten', () => {
    const last = parseCmTrace(text, 'a.log').at(-1);
    expect(last?.message).toBe('contact us…@contoso.com');
  });

  it('liefert [] ohne Treffer', () => {
    expect(parseCmTrace('nichts', 'a.log')).toEqual([]);
  });
});
