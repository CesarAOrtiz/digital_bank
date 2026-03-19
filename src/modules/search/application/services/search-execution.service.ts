import { Injectable } from '@nestjs/common';
import { NormalizedPagination } from '../../../../common/application/pagination';
import { AppLogger } from '../../../../common/infrastructure/logging/app-logger.service';

@Injectable()
export class SearchExecutionService {
  constructor(private readonly appLogger: AppLogger) {}

  paginateResults<T>(items: T[], page: NormalizedPagination): T[] {
    if (page.offset === 0 && page.limit >= items.length) {
      return items;
    }

    return items.slice(page.offset, page.offset + page.limit);
  }

  async runWithFallback<T>(
    scope: 'clients' | 'accounts' | 'transactions',
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    metadata: Record<string, unknown>,
  ): Promise<T> {
    try {
      return await primary();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Elastic error';
      this.appLogger.warn(`search.${scope}.fallback_to_postgres`, {
        ...metadata,
        reason: message,
      });
      return fallback();
    }
  }
}
