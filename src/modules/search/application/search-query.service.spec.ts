import { AccountStatus, Currency, TransactionType } from '../../../common/domain/enums';
import { AppLogger } from '../../../common/infrastructure/logging/app-logger.service';
import { SearchQueryService } from './search-query.service';

describe('SearchQueryService', () => {
  function createSut() {
    const elastic = {
      search: jest.fn(),
    };
    const appLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<AppLogger>;

    const service = new SearchQueryService(elastic as never, appLogger);

    return { service, elastic, appLogger };
  }

  it('searchClients debe devolver arreglo vacío y no consultar Elastic si el término está vacío', async () => {
    const { service, elastic } = createSut();

    const result = await service.searchClients('   ');

    expect(result).toEqual([]);
    expect(elastic.search).not.toHaveBeenCalled();
  });

  it('searchClients debe construir la query esperada en Elastic y mapear los documentos', async () => {
    const { service, elastic } = createSut();
    elastic.search.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              id: 'client-1',
              firstName: 'Ada',
              lastName: 'Lovelace',
              fullName: 'Ada Lovelace',
              email: 'ada@example.com',
              documentNumber: 'DOC-1',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-02T00:00:00.000Z',
            },
          },
        ],
      },
    });

    const result = await service.searchClients('  Ada  ');

    expect(elastic.search).toHaveBeenCalledWith({
      index: 'clients',
      query: {
        bool: {
          should: [
            {
              multi_match: {
                query: 'Ada',
                fields: ['fullName^3', 'firstName^2', 'lastName^2', 'email'],
                type: 'bool_prefix',
              },
            },
            {
              wildcard: {
                documentNumber: {
                  value: '*ada*',
                  case_insensitive: true,
                },
              },
            },
            {
              wildcard: {
                'email.keyword': {
                  value: '*ada*',
                  case_insensitive: true,
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      },
      sort: [{ _score: { order: 'desc' } }, { createdAt: { order: 'desc' } }],
      size: 25,
    });
    expect(result).toHaveLength(1);
    expect(result[0].toPrimitives()).toEqual({
      id: 'client-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      documentNumber: 'DOC-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
  });

  it('searchAccounts debe construir la búsqueda por wildcard y formatear balances numéricos', async () => {
    const { service, elastic } = createSut();
    elastic.search.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              id: 'account-1',
              accountNumber: 'ACC-001',
              clientId: 'client-1',
              currency: Currency.USD,
              status: AccountStatus.ACTIVE,
              balance: 1234.5,
              createdAt: '2026-01-03T00:00:00.000Z',
              updatedAt: '2026-01-04T00:00:00.000Z',
            },
          },
        ],
      },
    });

    const result = await service.searchAccounts(' ACC ');

    expect(elastic.search).toHaveBeenCalledWith({
      index: 'accounts',
      query: {
        bool: {
          should: [
            {
              wildcard: {
                accountNumber: {
                  value: '*acc*',
                  case_insensitive: true,
                },
              },
            },
            {
              wildcard: {
                clientId: {
                  value: '*acc*',
                  case_insensitive: true,
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      },
      sort: [{ _score: { order: 'desc' } }, { createdAt: { order: 'desc' } }],
      size: 25,
    });
    expect(result[0].toPrimitives()).toEqual({
      id: 'account-1',
      accountNumber: 'ACC-001',
      clientId: 'client-1',
      currency: Currency.USD,
      status: AccountStatus.ACTIVE,
      balance: '1234.50',
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
      updatedAt: new Date('2026-01-04T00:00:00.000Z'),
    });
  });

  it('searchTransactions debe construir la query completa cuando se envían filtros', async () => {
    const { service, elastic } = createSut();
    elastic.search.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              id: 'tx-1',
              type: TransactionType.TRANSFER,
              sourceAccountId: 'source-1',
              destinationAccountId: 'dest-1',
              sourceCurrency: Currency.USD,
              destinationCurrency: Currency.DOP,
              sourceAmount: 10,
              destinationAmount: 605,
              exchangeRateUsed: '60.500000',
              description: 'international transfer',
              idempotencyKey: 'tx-001',
              createdAt: '2026-01-05T00:00:00.000Z',
            },
          },
        ],
      },
    });

    const result = await service.searchTransactions({
      text: ' Transfer ',
      type: TransactionType.TRANSFER,
      accountId: 'account-any',
      sourceAccountId: 'source-1',
      destinationAccountId: 'dest-1',
      currency: Currency.DOP,
      dateFrom: new Date('2026-01-01T00:00:00.000Z'),
      dateTo: new Date('2026-01-31T23:59:59.000Z'),
    });

    expect(elastic.search).toHaveBeenCalledWith({
      index: 'transactions',
      query: {
        bool: {
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
        },
      },
      sort: [{ _score: { order: 'desc' } }, { createdAt: { order: 'desc' } }],
      size: 50,
    });
    expect(result[0].toPrimitives()).toEqual({
      id: 'tx-1',
      type: TransactionType.TRANSFER,
      sourceAccountId: 'source-1',
      destinationAccountId: 'dest-1',
      sourceCurrency: Currency.USD,
      destinationCurrency: Currency.DOP,
      sourceAmount: '10.00',
      destinationAmount: '605.00',
      exchangeRateUsed: '60.500000',
      description: 'international transfer',
      idempotencyKey: 'tx-001',
      createdAt: new Date('2026-01-05T00:00:00.000Z'),
    });
  });

  it('searchTransactions debe ordenar solo por createdAt cuando no hay búsqueda por texto', async () => {
    const { service, elastic } = createSut();
    elastic.search.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              id: 'tx-2',
              type: TransactionType.DEPOSIT,
              sourceAccountId: null,
              destinationAccountId: 'account-1',
              sourceCurrency: Currency.USD,
              destinationCurrency: Currency.USD,
              sourceAmount: 50,
              destinationAmount: 50,
              exchangeRateUsed: null,
              description: null,
              idempotencyKey: 'dep-1',
              createdAt: '2026-01-06T00:00:00.000Z',
            },
          },
        ],
      },
    });

    await service.searchTransactions({
      type: TransactionType.DEPOSIT,
    });

    expect(elastic.search).toHaveBeenCalledWith({
      index: 'transactions',
      query: {
        bool: {
          filter: [{ term: { type: TransactionType.DEPOSIT } }],
        },
      },
      sort: [{ createdAt: { order: 'desc' } }],
      size: 50,
    });
  });
});
