import { describe, expect, it } from 'vitest';
import { scenarios } from '../providers/mock/scenarios';
import { deviceIconKind } from './deviceIcon';

describe('Plattform-Symbole der Beispielgeräte', () => {
  const kind = (name: string) => {
    const scenario = scenarios.find((s) => s.deviceName === name)!;
    return deviceIconKind(scenario.build(new Date()).device);
  };

  it('iPhone und Android zeigen das Smartphone, Windows und Mac den Laptop', () => {
    expect(kind('CONTOSO-IP015')).toBe('smartphone');
    expect(kind('CONTOSO-AND21')).toBe('smartphone');
    expect(kind('CONTOSO-PC001')).toBe('laptop');
    expect(kind('CONTOSO-MAC07')).toBe('laptop');
  });
});
