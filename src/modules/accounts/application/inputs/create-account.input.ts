import type { Currency } from '../../../../common/domain/enums';

export interface CreateAccountInput {
  accountNumber: string;
  clientId: string;
  currency: Currency;
  initialBalance?: string;
}
