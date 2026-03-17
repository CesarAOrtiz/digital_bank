import { Global, Module } from '@nestjs/common';
import { elasticsearchProvider } from './elasticsearch.provider';
import { ELASTIC_CLIENT } from './elasticsearch.tokens';

@Global()
@Module({
  providers: [elasticsearchProvider],
  exports: [ELASTIC_CLIENT],
})
export class ElasticsearchModule {}
