import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import { ELASTIC_CLIENT } from './elasticsearch.tokens';

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export const elasticsearchProvider = {
  provide: ELASTIC_CLIENT,
  useFactory: () => {
    const logger = new Logger('ElasticClientProvider');
    const node = getOptionalEnv('ELASTICSEARCH_NODE');
    const apiKey = getOptionalEnv('ELASTICSEARCH_API_KEY');
    const username = getOptionalEnv('ELASTICSEARCH_USERNAME');
    const password = getOptionalEnv('ELASTICSEARCH_PASSWORD');

    const client = new ElasticClient({
      node,
      auth: apiKey
        ? { apiKey }
        : username || password
          ? { username: username ?? '', password: password ?? '' }
          : undefined,
    });

    logger.log(`Elasticsearch client configured for node ${node}.`);
    return client;
  },
};
