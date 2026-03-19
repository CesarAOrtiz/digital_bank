import { Global, Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { ClientsModule } from '../clients/clients.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { SearchIndexingService } from './application/search-indexing.service';
import { SearchReindexService } from './application/search-reindex.service';
import { SearchQueryService } from './application/search-query.service';

@Global()
@Module({
  imports: [ClientsModule, AccountsModule, TransactionsModule],
  providers: [SearchIndexingService, SearchQueryService, SearchReindexService],
  exports: [SearchIndexingService, SearchQueryService, SearchReindexService],
})
export class SearchModule {}
