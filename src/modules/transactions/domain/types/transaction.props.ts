import type { Currency, TransactionType } from '../../../../common/domain/enums';

export interface TransactionProps {
  id: string;
  type: TransactionType;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  sourceCurrency: Currency;
  destinationCurrency: Currency | null;
  sourceAmount: string;
  destinationAmount: string | null;
  exchangeRateUsed: string | null;
  idempotencyKey: string | null;
  description: string | null;
  createdAt: Date;
}
