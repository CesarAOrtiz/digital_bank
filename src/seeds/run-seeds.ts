import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import { DataSource } from 'typeorm';
import {
  AccountStatus,
  Currency,
  TransactionType,
} from '../common/domain/enums';
import { getOptionalEnv } from '../common/infrastructure/env/env.utils';
import { createDatabaseOptions } from '../config/database.config';
import { Account } from '../modules/accounts/domain';
import { AccountOrmEntity } from '../modules/accounts/infrastructure';
import { Client } from '../modules/clients/domain';
import { ClientOrmEntity } from '../modules/clients/infrastructure';
import { ExchangeRateOrmEntity } from '../modules/exchange-rates/infrastructure';
import { SearchIndexingService } from '../modules/search/application/search-indexing.service';
import { Transaction } from '../modules/transactions/domain';
import { TransactionOrmEntity } from '../modules/transactions/infrastructure';

const logger = new Logger('SeedRunner');
const CLIENTS_INDEX = 'clients';
const ACCOUNTS_INDEX = 'accounts';
const TRANSACTIONS_INDEX = 'transactions';

interface SeedOptions {
  reset: boolean;
  purge: boolean;
}

const clients = [
  {
    id: 'a1111111-1111-4111-8111-111111111111',
    firstName: 'Ana',
    lastName: 'Martinez',
    email: 'ana.martinez@example.com',
    documentNumber: '001-0000001-1',
    createdAt: new Date('2026-01-10T10:00:00.000Z'),
    updatedAt: new Date('2026-01-10T10:00:00.000Z'),
  },
  {
    id: 'b2222222-2222-4222-8222-222222222222',
    firstName: 'Luis',
    lastName: 'Gomez',
    email: 'luis.gomez@example.com',
    documentNumber: '001-0000002-2',
    createdAt: new Date('2026-01-10T10:05:00.000Z'),
    updatedAt: new Date('2026-01-10T10:05:00.000Z'),
  },
  {
    id: 'c3333333-3333-4333-8333-333333333333',
    firstName: 'Sofia',
    lastName: 'Reyes',
    email: 'sofia.reyes@example.com',
    documentNumber: '001-0000003-3',
    createdAt: new Date('2026-01-10T10:10:00.000Z'),
    updatedAt: new Date('2026-01-10T10:10:00.000Z'),
  },
];

const accounts = [
  {
    id: 'd1111111-1111-4111-8111-111111111111',
    accountNumber: 'USD-0001',
    clientId: clients[0].id,
    currency: Currency.USD,
    balance: '2050.00',
    status: AccountStatus.ACTIVE,
    createdAt: new Date('2026-01-11T09:00:00.000Z'),
    updatedAt: new Date('2026-01-14T16:00:00.000Z'),
  },
  {
    id: 'd2222222-2222-4222-8222-222222222222',
    accountNumber: 'DOP-0001',
    clientId: clients[0].id,
    currency: Currency.DOP,
    balance: '15500.00',
    status: AccountStatus.ACTIVE,
    createdAt: new Date('2026-01-11T09:05:00.000Z'),
    updatedAt: new Date('2026-01-14T16:05:00.000Z'),
  },
  {
    id: 'e1111111-1111-4111-8111-111111111111',
    accountNumber: 'USD-0002',
    clientId: clients[1].id,
    currency: Currency.USD,
    balance: '520.00',
    status: AccountStatus.ACTIVE,
    createdAt: new Date('2026-01-11T09:10:00.000Z'),
    updatedAt: new Date('2026-01-14T16:10:00.000Z'),
  },
  {
    id: 'f1111111-1111-4111-8111-111111111111',
    accountNumber: 'EUR-0001',
    clientId: clients[2].id,
    currency: Currency.EUR,
    balance: '990.00',
    status: AccountStatus.ACTIVE,
    createdAt: new Date('2026-01-11T09:15:00.000Z'),
    updatedAt: new Date('2026-01-14T16:15:00.000Z'),
  },
  {
    id: 'f2222222-2222-4222-8222-222222222222',
    accountNumber: 'DOP-0002',
    clientId: clients[2].id,
    currency: Currency.DOP,
    balance: '3120.00',
    status: AccountStatus.ACTIVE,
    createdAt: new Date('2026-01-11T09:20:00.000Z'),
    updatedAt: new Date('2026-01-14T16:20:00.000Z'),
  },
];

const exchangeRates = [
  {
    id: 'aa111111-1111-4111-8111-111111111111',
    baseCurrency: Currency.USD,
    targetCurrency: Currency.DOP,
    rate: '60.500000',
    effectiveAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  {
    id: 'aa222222-2222-4222-8222-222222222222',
    baseCurrency: Currency.EUR,
    targetCurrency: Currency.DOP,
    rate: '62.400000',
    effectiveAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  {
    id: 'aa333333-3333-4333-8333-333333333333',
    baseCurrency: Currency.USD,
    targetCurrency: Currency.EUR,
    rate: '0.920000',
    effectiveAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
];

const transactions = [
  {
    id: 'bb111111-1111-4111-8111-111111111111',
    type: TransactionType.DEPOSIT,
    sourceAccountId: null,
    destinationAccountId: accounts[0].id,
    sourceCurrency: Currency.USD,
    destinationCurrency: Currency.USD,
    sourceAmount: '1900.00',
    destinationAmount: '1900.00',
    exchangeRateUsed: null,
    idempotencyKey: 'seed-deposit-001',
    description: 'Saldo inicial cuenta USD principal',
    createdAt: new Date('2026-01-11T09:30:00.000Z'),
  },
  {
    id: 'bb222222-2222-4222-8222-222222222222',
    type: TransactionType.DEPOSIT,
    sourceAccountId: null,
    destinationAccountId: accounts[1].id,
    sourceCurrency: Currency.DOP,
    destinationCurrency: Currency.DOP,
    sourceAmount: '3400.00',
    destinationAmount: '3400.00',
    exchangeRateUsed: null,
    idempotencyKey: 'seed-deposit-002',
    description: 'Saldo inicial cuenta DOP principal',
    createdAt: new Date('2026-01-11T09:35:00.000Z'),
  },
  {
    id: 'bb333333-3333-4333-8333-333333333333',
    type: TransactionType.DEPOSIT,
    sourceAccountId: null,
    destinationAccountId: accounts[2].id,
    sourceCurrency: Currency.USD,
    destinationCurrency: Currency.USD,
    sourceAmount: '450.00',
    destinationAmount: '450.00',
    exchangeRateUsed: null,
    idempotencyKey: 'seed-deposit-003',
    description: 'Saldo inicial cuenta USD secundaria',
    createdAt: new Date('2026-01-11T09:40:00.000Z'),
  },
  {
    id: 'bb444444-4444-4444-8444-444444444444',
    type: TransactionType.DEPOSIT,
    sourceAccountId: null,
    destinationAccountId: accounts[3].id,
    sourceCurrency: Currency.EUR,
    destinationCurrency: Currency.EUR,
    sourceAmount: '1040.00',
    destinationAmount: '1040.00',
    exchangeRateUsed: null,
    idempotencyKey: 'seed-deposit-004',
    description: 'Saldo inicial cuenta EUR',
    createdAt: new Date('2026-01-11T09:45:00.000Z'),
  },
  {
    id: 'bb555555-5555-4555-8555-555555555555',
    type: TransactionType.DEPOSIT,
    sourceAccountId: null,
    destinationAccountId: accounts[0].id,
    sourceCurrency: Currency.USD,
    destinationCurrency: Currency.USD,
    sourceAmount: '500.00',
    destinationAmount: '500.00',
    exchangeRateUsed: null,
    idempotencyKey: 'seed-deposit-005',
    description: 'Depósito de prueba en cuenta principal',
    createdAt: new Date('2026-01-12T08:00:00.000Z'),
  },
  {
    id: 'bb666666-6666-4666-8666-666666666666',
    type: TransactionType.WITHDRAWAL,
    sourceAccountId: accounts[2].id,
    destinationAccountId: null,
    sourceCurrency: Currency.USD,
    destinationCurrency: null,
    sourceAmount: '80.00',
    destinationAmount: null,
    exchangeRateUsed: null,
    idempotencyKey: 'seed-withdrawal-001',
    description: 'Retiro de prueba',
    createdAt: new Date('2026-01-12T09:00:00.000Z'),
  },
  {
    id: 'bb777777-7777-4777-8777-777777777777',
    type: TransactionType.TRANSFER,
    sourceAccountId: accounts[0].id,
    destinationAccountId: accounts[2].id,
    sourceCurrency: Currency.USD,
    destinationCurrency: Currency.USD,
    sourceAmount: '150.00',
    destinationAmount: '150.00',
    exchangeRateUsed: null,
    idempotencyKey: 'seed-transfer-001',
    description: 'Transferencia misma moneda',
    createdAt: new Date('2026-01-13T11:00:00.000Z'),
  },
  {
    id: 'bb888888-8888-4888-8888-888888888888',
    type: TransactionType.TRANSFER,
    sourceAccountId: accounts[0].id,
    destinationAccountId: accounts[1].id,
    sourceCurrency: Currency.USD,
    destinationCurrency: Currency.DOP,
    sourceAmount: '200.00',
    destinationAmount: '12100.00',
    exchangeRateUsed: '60.500000',
    idempotencyKey: 'seed-transfer-002',
    description: 'Transferencia USD a DOP',
    createdAt: new Date('2026-01-14T15:00:00.000Z'),
  },
  {
    id: 'bb999999-9999-4999-8999-999999999999',
    type: TransactionType.TRANSFER,
    sourceAccountId: accounts[3].id,
    destinationAccountId: accounts[4].id,
    sourceCurrency: Currency.EUR,
    destinationCurrency: Currency.DOP,
    sourceAmount: '50.00',
    destinationAmount: '3120.00',
    exchangeRateUsed: '62.400000',
    idempotencyKey: 'seed-transfer-003',
    description: 'Transferencia EUR a DOP',
    createdAt: new Date('2026-01-14T16:00:00.000Z'),
  },
];

const clientIds = clients.map((client) => client.id);
const accountIds = accounts.map((account) => account.id);
const exchangeRateIds = exchangeRates.map((exchangeRate) => exchangeRate.id);
const transactionIds = transactions.map((transaction) => transaction.id);

function parseOptions(argv: string[]): SeedOptions {
  const resetFromArgv = argv.includes('--reset');
  const resetFromNpmConfig = ['true', '1'].includes(
    (process.env.npm_config_reset ?? '').trim().toLowerCase(),
  );
  const purgeFromArgv = argv.includes('--purge');
  const purgeFromNpmConfig = ['true', '1'].includes(
    (process.env.npm_config_purge ?? '').trim().toLowerCase(),
  );

  return {
    reset: resetFromArgv || resetFromNpmConfig,
    purge: purgeFromArgv || purgeFromNpmConfig,
  };
}

async function resetSeedData(dataSource: DataSource): Promise<void> {
  logger.log(
    'Eliminando únicamente registros seed conocidos.',
  );

  await dataSource.getRepository(TransactionOrmEntity).delete(transactionIds);
  await dataSource.getRepository(AccountOrmEntity).delete(accountIds);
  await dataSource.getRepository(ExchangeRateOrmEntity).delete(exchangeRateIds);
  await dataSource.getRepository(ClientOrmEntity).delete(clientIds);

  logger.log('Registros seed eliminados correctamente.');
}

async function deleteElasticDocuments(
  elastic: ElasticClient,
  index: string,
  ids: string[],
): Promise<void> {
  for (const id of ids) {
    try {
      await elastic.delete({ index, id });
    } catch (error) {
      const statusCode =
        typeof error === 'object' &&
        error &&
        'meta' in error &&
        typeof (error as { meta?: { statusCode?: number } }).meta
          ?.statusCode === 'number'
          ? (error as { meta?: { statusCode?: number } }).meta?.statusCode
          : undefined;

      if (statusCode === 404) {
        continue;
      }

      throw error;
    }
  }
}

async function resetElasticData(elastic: ElasticClient): Promise<void> {
  logger.log(
    'Eliminando documentos seed conocidos en Elastic.',
  );

  await deleteElasticDocuments(elastic, TRANSACTIONS_INDEX, transactionIds);
  await deleteElasticDocuments(elastic, ACCOUNTS_INDEX, accountIds);
  await deleteElasticDocuments(elastic, CLIENTS_INDEX, clientIds);

  logger.log('Documentos seed eliminados correctamente de Elastic.');
}

async function seedDatabase(dataSource: DataSource): Promise<void> {
  await dataSource.getRepository(ClientOrmEntity).save(clients);
  await dataSource.getRepository(AccountOrmEntity).save(accounts);
  await dataSource.getRepository(ExchangeRateOrmEntity).save(exchangeRates);
  await dataSource.getRepository(TransactionOrmEntity).save(transactions);
}

async function syncElastic(options: SeedOptions): Promise<void> {
  const node = getOptionalEnv('ELASTICSEARCH_NODE');
  if (!node) {
    logger.log(
      'ELASTICSEARCH_NODE no está configurado. Se omite sincronización con Elastic.',
    );
    return;
  }

  const apiKey = getOptionalEnv('ELASTICSEARCH_API_KEY');
  const username = getOptionalEnv('ELASTICSEARCH_USERNAME');
  const password = getOptionalEnv('ELASTICSEARCH_PASSWORD');

  const elastic = new ElasticClient({
    node,
    auth: apiKey
      ? { apiKey }
      : username || password
        ? { username: username ?? '', password: password ?? '' }
        : undefined,
  });

  const indexingService = new SearchIndexingService(elastic);

  try {
    await indexingService.onModuleInit();
    if (options.reset || options.purge) {
      await resetElasticData(elastic);
    }
    if (options.purge) {
      logger.log('Modo purge activado. No se reindexarán documentos seed en Elastic.');
      return;
    }
    await Promise.all(
      clients.map((client) => indexingService.indexClient(new Client(client))),
    );
    await Promise.all(
      accounts.map((account) =>
        indexingService.indexAccount(new Account(account)),
      ),
    );
    await Promise.all(
      transactions.map((transaction) =>
        indexingService.indexTransaction(new Transaction(transaction)),
      ),
    );
    logger.log('Índices de Elastic sincronizados con los datos seed.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`No se pudo sincronizar Elastic durante el seed: ${message}`);
  } finally {
    await elastic.close();
  }
}

async function run(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (options.reset && options.purge) {
    throw new Error('No se pueden usar --reset y --purge al mismo tiempo.');
  }

  const dataSource = new DataSource(createDatabaseOptions('development-cli'));
  try {
    await dataSource.initialize();
    logger.log('Conexión a PostgreSQL inicializada para seeds.');
    if (options.reset || options.purge) {
      await resetSeedData(dataSource);
    }
    if (options.purge) {
      logger.log('Modo purge activado. No se insertarán registros seed en PostgreSQL.');
    } else {
      await seedDatabase(dataSource);
      logger.log(
        `Seeds aplicados: ${clients.length} clientes, ${accounts.length} cuentas, ${exchangeRates.length} tasas, ${transactions.length} transacciones.`,
      );
    }
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }

  await syncElastic(options);
}

run().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  logger.error('La ejecución de seeds falló.', message);
  process.exit(1);
});
