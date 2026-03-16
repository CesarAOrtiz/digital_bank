import type { TransactionType } from '../../../../common/domain/enums';

export interface TransactionSearchFilters {
  text?: string;
  type?: TransactionType;
  accountId?: string;
}
