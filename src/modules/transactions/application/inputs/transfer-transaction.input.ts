export interface TransferTransactionInput {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: string;
  description?: string;
  idempotencyKey?: string;
}
