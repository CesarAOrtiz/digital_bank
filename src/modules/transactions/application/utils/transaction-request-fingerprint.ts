import { createHash } from 'crypto';
import { formatMoney } from '../../../../common/application/money';
import { TransactionType } from '../../../../common/domain/enums';
import type { DepositTransactionInput } from '../inputs/deposit-transaction.input';
import type { TransferTransactionInput } from '../inputs/transfer-transaction.input';
import type { WithdrawTransactionInput } from '../inputs/withdraw-transaction.input';

function normalizeDescription(description?: string | null): string | null {
  return description?.trim() || null;
}

function hashCanonicalPayload(payload: Record<string, unknown>): string {
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

export function buildDepositRequestFingerprint(
  data: DepositTransactionInput,
): string {
  return hashCanonicalPayload({
    type: TransactionType.DEPOSIT,
    accountId: data.accountId,
    amount: formatMoney(data.amount),
    description: normalizeDescription(data.description),
  });
}

export function buildWithdrawalRequestFingerprint(
  data: WithdrawTransactionInput,
): string {
  return hashCanonicalPayload({
    type: TransactionType.WITHDRAWAL,
    accountId: data.accountId,
    amount: formatMoney(data.amount),
    description: normalizeDescription(data.description),
  });
}

export function buildTransferRequestFingerprint(
  data: TransferTransactionInput,
): string {
  return hashCanonicalPayload({
    type: TransactionType.TRANSFER,
    sourceAccountId: data.sourceAccountId,
    destinationAccountId: data.destinationAccountId,
    amount: formatMoney(data.amount),
    description: normalizeDescription(data.description),
  });
}
