import { Global, Module } from '@nestjs/common';
import { SearchIndexingService } from './application/search-indexing.service';
import { SearchQueryService } from './application/search-query.service';

@Global()
@Module({
  providers: [SearchIndexingService, SearchQueryService],
  exports: [SearchIndexingService, SearchQueryService],
})
export class SearchModule {}
