import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';

type ErrorPayload = {
  message: string;
  errorCode: string;
};

function getMessage(response: string | object): string {
  if (typeof response === 'string') {
    return response;
  }

  const message = (response as { message?: string | string[] }).message;
  return Array.isArray(message)
    ? message.join(', ')
    : (message ?? 'Unexpected error');
}

export class DomainRuleViolationException extends BadRequestException {
  constructor(
    message: string,
    public readonly errorCode = 'DOMAIN_RULE_VIOLATION',
  ) {
    super({ message, errorCode } satisfies ErrorPayload);
  }
}

export class ResourceNotFoundException extends NotFoundException {
  constructor(
    message: string,
    public readonly errorCode = 'RESOURCE_NOT_FOUND',
  ) {
    super({ message, errorCode } satisfies ErrorPayload);
  }
}

export class DuplicateResourceException extends ConflictException {
  constructor(
    message: string,
    public readonly errorCode = 'DUPLICATE_RESOURCE',
  ) {
    super({ message, errorCode } satisfies ErrorPayload);
  }
}

export class InsufficientFundsException extends DomainRuleViolationException {
  constructor(accountId: string) {
    super(`Account ${accountId} has insufficient funds.`, 'INSUFFICIENT_FUNDS');
  }
}

export class AccountBlockedException extends DomainRuleViolationException {
  constructor(accountId: string) {
    super(`Account ${accountId} is blocked.`, 'ACCOUNT_BLOCKED');
  }
}

export class AccountInactiveException extends DomainRuleViolationException {
  constructor(accountId: string) {
    super(`Account ${accountId} is inactive.`, 'ACCOUNT_INACTIVE');
  }
}

export class DuplicateClientException extends DuplicateResourceException {
  constructor(field: 'email' | 'documentNumber', value: string) {
    super(`Client ${field} ${value} already exists.`, 'DUPLICATE_CLIENT');
  }
}

export class IdempotencyKeyReuseException extends ConflictException {
  constructor() {
    super({
      message: 'Idempotency key was already used with a different request payload.',
      errorCode: 'IDEMPOTENCY_KEY_REUSE',
    } satisfies ErrorPayload);
  }
}

export class ExchangeRateNotConfiguredException extends BadRequestException {
  constructor(baseCurrency: string, targetCurrency: string) {
    super({
      message: `No exchange rate configured for ${baseCurrency} -> ${targetCurrency}.`,
      errorCode: 'EXCHANGE_RATE_NOT_CONFIGURED',
    } satisfies ErrorPayload);
  }
}

export function getExceptionMessage(exception: unknown): string {
  if (exception instanceof HttpException) {
    return getMessage(exception.getResponse());
  }

  if (exception instanceof Error) {
    return exception.message;
  }

  return 'Unexpected error';
}

export function getExceptionCode(exception: unknown): string {
  if (
    exception instanceof DomainRuleViolationException ||
    exception instanceof ResourceNotFoundException ||
    exception instanceof DuplicateResourceException
  ) {
    return exception.errorCode;
  }

  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    if (typeof response === 'object' && response && 'errorCode' in response) {
      return String((response as { errorCode: string }).errorCode);
    }
  }

  return 'INTERNAL_SERVER_ERROR';
}
