import { Injectable } from '@nestjs/common';
import {
  NormalizedPagination,
  normalizePagination,
} from '../../../../common/application/pagination';
import { TransactionSearchFilters } from '../../../transactions/domain';

interface TransactionSearchQuery {
  must: object[];
  filter: object[];
  page: NormalizedPagination;
  metadata: Record<string, unknown>;
}

@Injectable()
export class TransactionSearchQueryBuilderService {
  build(
    filters: TransactionSearchFilters,
    limit?: number,
    offset?: number,
  ): TransactionSearchQuery {
    const page = normalizePagination({ limit, offset, defaultLimit: 50 });
    const must: object[] = [];
    const filter: object[] = [];

    if (filters.text?.trim()) {
      const normalizedText = filters.text.trim();
      must.push({
        bool: {
          should: [
            {
              match: {
                description: {
                  query: normalizedText,
                  operator: 'and',
                },
              },
            },
            {
              wildcard: {
                idempotencyKey: {
                  value: `*${normalizedText.toLowerCase()}*`,
                  case_insensitive: true,
                },
              },
            },
            {
              wildcard: {
                id: {
                  value: `*${normalizedText.toLowerCase()}*`,
                  case_insensitive: true,
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      });
    }

    if (filters.type) {
      filter.push({ term: { type: filters.type } });
    }

    if (filters.sourceAccountId) {
      filter.push({ term: { sourceAccountId: filters.sourceAccountId } });
    }

    if (filters.destinationAccountId) {
      filter.push({
        term: { destinationAccountId: filters.destinationAccountId },
      });
    }

    if (filters.accountId) {
      filter.push({
        bool: {
          should: [
            { term: { sourceAccountId: filters.accountId } },
            { term: { destinationAccountId: filters.accountId } },
          ],
          minimum_should_match: 1,
        },
      });
    }

    if (filters.currency) {
      filter.push({
        bool: {
          should: [
            { term: { sourceCurrency: filters.currency } },
            { term: { destinationCurrency: filters.currency } },
          ],
          minimum_should_match: 1,
        },
      });
    }

    if (filters.dateFrom || filters.dateTo) {
      filter.push({
        range: {
          createdAt: {
            ...(filters.dateFrom ? { gte: filters.dateFrom.toISOString() } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo.toISOString() } : {}),
          },
        },
      });
    }

    return {
      must,
      filter,
      page,
      metadata: {
        text: filters.text?.trim() || undefined,
        type: filters.type,
        accountId: filters.accountId,
        sourceAccountId: filters.sourceAccountId,
        destinationAccountId: filters.destinationAccountId,
        currency: filters.currency,
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString(),
        offset: page.offset,
        limit: page.limit,
      },
    };
  }
}
