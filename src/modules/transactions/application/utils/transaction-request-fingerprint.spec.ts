import {
  buildDepositRequestFingerprint,
  buildTransferRequestFingerprint,
  buildWithdrawalRequestFingerprint,
} from './transaction-request-fingerprint';

describe('transaction-request-fingerprint', () => {
  it('debe generar el mismo fingerprint para payloads equivalentes tras normalización', () => {
    const first = buildDepositRequestFingerprint({
      accountId: 'account-1',
      amount: '10',
      description: ' cash-in ',
      idempotencyKey: 'dep-1',
    });
    const second = buildDepositRequestFingerprint({
      accountId: 'account-1',
      amount: '10.00',
      description: 'cash-in',
      idempotencyKey: 'dep-2',
    });

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });

  it('debe generar fingerprints distintos para payloads distintos', () => {
    const withdrawal = buildWithdrawalRequestFingerprint({
      accountId: 'account-1',
      amount: '10.00',
      description: 'atm',
      idempotencyKey: 'wd-1',
    });
    const transfer = buildTransferRequestFingerprint({
      sourceAccountId: 'account-1',
      destinationAccountId: 'account-2',
      amount: '10.00',
      description: 'atm',
      idempotencyKey: 'tr-1',
    });

    expect(withdrawal).not.toBe(transfer);
  });
});
