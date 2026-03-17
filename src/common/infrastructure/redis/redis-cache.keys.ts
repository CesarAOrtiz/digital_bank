import type { Currency } from '../../domain/enums';

export const RedisCacheKeys = {
  client: (id: string): string => `client:${id}`,
  clientAccounts: (clientId: string): string => `client-accounts:${clientId}`,
  exchangeRate: (baseCurrency: Currency, targetCurrency: Currency): string =>
    `fx:${baseCurrency}:${targetCurrency}`,
} as const;

export const RedisCacheTtl = {
  client: 600,
  clientAccounts: 600,
  exchangeRate: 300,
} as const;
