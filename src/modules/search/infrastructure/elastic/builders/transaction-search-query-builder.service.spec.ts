import { Currency, TransactionType } from '../../../../../common/domain/enums';
import { TransactionSearchQueryBuilderService } from './transaction-search-query-builder.service';

describe('TransactionSearchQueryBuilderService', () => {
  function createSut() {
    return new TransactionSearchQueryBuilderService();
  }

  it('debe construir must, filter y metadata cuando se envían todos los filtros', () => {
    const service = createSut();

    const result = service.build(
      {
        text: ' Transfer ',
        type: TransactionType.TRANSFER,
        accountId: 'account-any',
        sourceAccountId: 'source-1',
        destinationAccountId: 'dest-1',
        currency: Currency.DOP,
        dateFrom: new Date('2026-01-01T00:00:00.000Z'),
        dateTo: new Date('2026-01-31T23:59:59.000Z'),
      },
      20,
      40,
    );

    expect(result).toEqual({
      must: [
        {
          bool: {
            should: [
              {
                match: {
                  description: {
                    query: 'Transfer',
                    operator: 'and',
                  },
                },
              },
              {
                wildcard: {
                  idempotencyKey: {
                    value: '*transfer*',
                    case_insensitive: true,
                  },
                },
              },
              {
                wildcard: {
                  id: {
                    value: '*transfer*',
                    case_insensitive: true,
                  },
                },
              },
            ],
            minimum_should_match: 1,
          },
        },
      ],
      filter: [
        { term: { type: TransactionType.TRANSFER } },
        { term: { sourceAccountId: 'source-1' } },
        { term: { destinationAccountId: 'dest-1' } },
        {
          bool: {
            should: [
              { term: { sourceAccountId: 'account-any' } },
              { term: { destinationAccountId: 'account-any' } },
            ],
            minimum_should_match: 1,
          },
        },
        {
          bool: {
            should: [
              { term: { sourceCurrency: Currency.DOP } },
              { term: { destinationCurrency: Currency.DOP } },
            ],
            minimum_should_match: 1,
          },
        },
        {
          range: {
            createdAt: {
              gte: '2026-01-01T00:00:00.000Z',
              lte: '2026-01-31T23:59:59.000Z',
            },
          },
        },
      ],
      page: {
        limit: 20,
        offset: 40,
      },
      metadata: {
        text: 'Transfer',
        type: TransactionType.TRANSFER,
        accountId: 'account-any',
        sourceAccountId: 'source-1',
        destinationAccountId: 'dest-1',
        currency: Currency.DOP,
        dateFrom: '2026-01-01T00:00:00.000Z',
        dateTo: '2026-01-31T23:59:59.000Z',
        offset: 40,
        limit: 20,
      },
    });
  });

  it('debe usar paginación por defecto y omitir must cuando no hay texto', () => {
    const service = createSut();

    const result = service.build({
      type: TransactionType.DEPOSIT,
    });

    expect(result.must).toEqual([]);
    expect(result.filter).toEqual([{ term: { type: TransactionType.DEPOSIT } }]);
    expect(result.page).toEqual({
      limit: 50,
      offset: 0,
    });
    expect(result.metadata).toEqual({
      text: undefined,
      type: TransactionType.DEPOSIT,
      accountId: undefined,
      sourceAccountId: undefined,
      destinationAccountId: undefined,
      currency: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      offset: 0,
      limit: 50,
    });
  });
});
