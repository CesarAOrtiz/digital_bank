import type { AccountStatus, Currency } from '../../../../common/domain/enums';

export interface AccountProps {
  id: string;
  accountNumber: string;
  clientId: string;
  currency: Currency;
  balance: string;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}
