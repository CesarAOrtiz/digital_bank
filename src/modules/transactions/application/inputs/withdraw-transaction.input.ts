export interface WithdrawTransactionInput {
  accountId: string;
  amount: string;
  description?: string;
  idempotencyKey?: string;
}
