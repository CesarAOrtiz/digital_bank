import { formatMoney, formatRate, roundMoney, roundRate } from './money';

describe('money', () => {
  it('aplica ROUND_HALF_EVEN en montos con 2 decimales', () => {
    expect(roundMoney('10.005').toFixed(2)).toBe('10.00');
    expect(roundMoney('10.015').toFixed(2)).toBe('10.02');
    expect(formatMoney('2.225')).toBe('2.22');
    expect(formatMoney('2.235')).toBe('2.24');
  });

  it('aplica ROUND_HALF_EVEN en tasas con 6 decimales', () => {
    expect(roundRate('1.2345645').toFixed(6)).toBe('1.234564');
    expect(roundRate('1.2345655').toFixed(6)).toBe('1.234566');
    expect(formatRate('60.1234565')).toBe('60.123456');
    expect(formatRate('60.1234575')).toBe('60.123458');
  });
});
