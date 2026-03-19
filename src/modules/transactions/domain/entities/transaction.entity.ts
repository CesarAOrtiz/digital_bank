import type { TransactionProps } from '../types/transaction.props';

export class Transaction {
  constructor(
    private readonly props: TransactionProps & {
      requestFingerprint?: string | null;
    },
  ) {}

  get id(): string {
    return this.props.id;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get requestFingerprint(): string | null {
    return this.props.requestFingerprint ?? null;
  }

  toPrimitives(): TransactionProps {
    const { requestFingerprint, ...publicProps } = this.props;
    return publicProps;
  }
}
