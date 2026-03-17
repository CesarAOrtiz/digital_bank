import type { Currency, TransactionType } from '../../../../common/domain/enums';

export interface TransactionSearchFilters {
  text?: string;
  type?: TransactionType;
  accountId?: string;
  currency?: Currency;
  dateFrom?: Date;
  dateTo?: Date;
}
