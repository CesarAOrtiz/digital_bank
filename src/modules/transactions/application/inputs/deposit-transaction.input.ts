export interface DepositTransactionInput {
  accountId: string;
  amount: string;
  description?: string;
  idempotencyKey?: string;
}
