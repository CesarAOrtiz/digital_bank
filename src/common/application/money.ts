import Decimal from 'decimal.js';
import { DomainRuleViolationException } from '../domain/exceptions';

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_EVEN,
});

export const MONEY_SCALE = 2;
export const RATE_SCALE = 6;

export function toDecimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

export function roundMoney(value: Decimal.Value): Decimal {
  return toDecimal(value).toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_EVEN);
}

export function roundRate(value: Decimal.Value): Decimal {
  return toDecimal(value).toDecimalPlaces(RATE_SCALE, Decimal.ROUND_HALF_EVEN);
}

export function formatMoney(value: Decimal.Value): string {
  return roundMoney(value).toFixed(MONEY_SCALE);
}

export function formatRate(value: Decimal.Value): string {
  return roundRate(value).toFixed(RATE_SCALE);
}

export function ensurePositiveAmount(
  value: Decimal.Value,
  fieldName = 'amount',
): Decimal {
  const amount = roundMoney(value);
  if (amount.lte(0)) {
    throw new DomainRuleViolationException(
      `${fieldName} must be greater than zero.`,
    );
  }

  return amount;
}
