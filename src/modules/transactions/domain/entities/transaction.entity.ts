import type { TransactionProps } from '../types/transaction.props';

export class Transaction {
  constructor(private readonly props: TransactionProps) {}

  get id(): string {
    return this.props.id;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  toPrimitives(): TransactionProps {
    return { ...this.props };
  }
}
