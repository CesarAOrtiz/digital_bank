import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

export class DomainRuleViolationException extends BadRequestException {}

export class ResourceNotFoundException extends NotFoundException {}

export class DuplicateResourceException extends ConflictException {}

export class ExchangeRateNotConfiguredException extends BadRequestException {
  constructor(baseCurrency: string, targetCurrency: string) {
    super(
      `No exchange rate configured for ${baseCurrency} -> ${targetCurrency}.`,
    );
  }
}
