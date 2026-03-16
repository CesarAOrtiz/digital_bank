import {
  ensurePositiveAmount,
  formatMoney,
  toDecimal,
} from '../../../../common/application/money';
import {
  AccountBlockedException,
  AccountInactiveException,
  InsufficientFundsException,
} from '../../../../common/domain/exceptions';
import { AccountStatus, Currency } from '../../../../common/domain/enums';
import type { AccountProps } from '../types/account.props';

export class Account {
  constructor(private readonly props: AccountProps) {}

  get id(): string {
    return this.props.id;
  }

  get accountNumber(): string {
    return this.props.accountNumber;
  }

  get currency(): Currency {
    return this.props.currency;
  }

  ensureCanReceive(): void {
    if (this.props.status === AccountStatus.BLOCKED) {
      throw new AccountBlockedException(this.id);
    }

    if (this.props.status === AccountStatus.INACTIVE) {
      throw new AccountInactiveException(this.id);
    }
  }

  ensureCanSend(): void {
    this.ensureCanReceive();
  }

  deposit(amountValue: string): Account {
    this.ensureCanReceive();
    const amount = ensurePositiveAmount(amountValue);
    return this.withBalance(
      formatMoney(toDecimal(this.props.balance).plus(amount)),
    );
  }

  withdraw(amountValue: string): Account {
    this.ensureCanSend();
    const amount = ensurePositiveAmount(amountValue);
    const nextBalance = toDecimal(this.props.balance).minus(amount);
    if (nextBalance.lt(0)) {
      throw new InsufficientFundsException(this.id);
    }

    return this.withBalance(formatMoney(nextBalance));
  }

  toPrimitives(): AccountProps {
    return { ...this.props };
  }

  private withBalance(balance: string): Account {
    return new Account({
      ...this.props,
      balance,
      updatedAt: new Date(),
    });
  }
}
