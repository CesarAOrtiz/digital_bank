import { Global, Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { ClientsModule } from '../clients/clients.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { SearchAccountsUseCase } from './application/use-cases/search-accounts.use-case';
import { SearchClientsUseCase } from './application/use-cases/search-clients.use-case';
import { SearchTransactionsUseCase } from './application/use-cases/search-transactions.use-case';
import { SearchExecutionService } from './application/services/search-execution.service';
import { SearchReindexService } from './application/services/search-reindex.service';
import { SearchQueryService } from './application/services/search-query.service';
import { SearchElasticReaderService } from './infrastructure/elastic/search-elastic-reader.service';
import { SearchIndexingService } from './infrastructure/elastic/search-indexing.service';
import { TransactionSearchQueryBuilderService } from './infrastructure/elastic/builders/transaction-search-query-builder.service';

@Global()
@Module({
  imports: [ClientsModule, AccountsModule, TransactionsModule],
  providers: [
    SearchExecutionService,
    SearchElasticReaderService,
    TransactionSearchQueryBuilderService,
    SearchClientsUseCase,
    SearchAccountsUseCase,
    SearchTransactionsUseCase,
    SearchIndexingService,
    SearchQueryService,
    SearchReindexService,
  ],
  exports: [SearchIndexingService, SearchQueryService, SearchReindexService],
})
export class SearchModule {}
