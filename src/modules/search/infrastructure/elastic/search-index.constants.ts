import type { estypes } from '@elastic/elasticsearch';

export const CLIENTS_INDEX = 'clients';
export const ACCOUNTS_INDEX = 'accounts';
export const TRANSACTIONS_INDEX = 'transactions';

export const CLIENTS_MAPPING: Record<string, estypes.MappingProperty> = {
  id: { type: 'keyword' },
  firstName: {
    type: 'text',
    fields: { keyword: { type: 'keyword' } },
  },
  lastName: {
    type: 'text',
    fields: { keyword: { type: 'keyword' } },
  },
  fullName: {
    type: 'text',
    fields: { keyword: { type: 'keyword' } },
  },
  email: {
    type: 'text',
    fields: { keyword: { type: 'keyword' } },
  },
  documentNumber: { type: 'keyword' },
  createdAt: { type: 'date' },
  updatedAt: { type: 'date' },
};

export const ACCOUNTS_MAPPING: Record<string, estypes.MappingProperty> = {
  id: { type: 'keyword' },
  accountNumber: { type: 'keyword' },
  clientId: { type: 'keyword' },
  currency: { type: 'keyword' },
  status: { type: 'keyword' },
  balance: { type: 'scaled_float', scaling_factor: 100 },
  createdAt: { type: 'date' },
  updatedAt: { type: 'date' },
};

export const TRANSACTIONS_MAPPING: Record<string, estypes.MappingProperty> = {
  id: { type: 'keyword' },
  type: { type: 'keyword' },
  sourceAccountId: { type: 'keyword' },
  destinationAccountId: { type: 'keyword' },
  sourceCurrency: { type: 'keyword' },
  destinationCurrency: { type: 'keyword' },
  sourceAmount: { type: 'scaled_float', scaling_factor: 100 },
  destinationAmount: { type: 'scaled_float', scaling_factor: 100 },
  description: {
    type: 'text',
    fields: { keyword: { type: 'keyword' } },
  },
  exchangeRateUsed: { type: 'keyword' },
  idempotencyKey: { type: 'keyword' },
  createdAt: { type: 'date' },
};
