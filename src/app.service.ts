import { Inject, Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { TYPEORM_DATA_SOURCE } from './common/infrastructure/database.tokens';
import { REDIS_CLIENT } from './common/infrastructure/redis/redis.tokens';

@Injectable()
export class AppService {
  constructor(
    @Inject(TYPEORM_DATA_SOURCE) private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  getHealth() {
    return {
      service: 'digital_bank',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async checkPostgres(): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check('postgres');

    try {
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
      }

      await this.dataSource.query('SELECT 1');
      return indicator.up();
    } catch (error) {
      throw new HealthCheckError(
        'Postgres check failed',
        indicator.down({ message: this.getHealthErrorMessage('postgres', error) }),
      );
    }
  }

  async checkRedis(): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check('redis');

    try {
      await this.ensureRedisConnection();
      const result = await this.redis.ping();
      if (result !== 'PONG') {
        throw new Error(`Unexpected Redis ping response: ${result}`);
      }

      return indicator.up(`status=${this.redis.status}`);
    } catch (error) {
      throw new HealthCheckError(
        'Redis check failed',
        indicator.down({
          message: this.getHealthErrorMessage('redis', error),
        }),
      );
    }
  }

  async checkElastic(): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check('elastic');
    const node = process.env.ELASTICSEARCH_NODE ?? 'http://localhost:9200';
    const client = new ElasticClient({ node });

    try {
      await client.ping();
      return indicator.up({ node });
    } catch (error) {
      throw new HealthCheckError(
        'Elastic check failed',
        indicator.down({
          message: this.getHealthErrorMessage('elastic', error),
          node: this.isProduction() ? undefined : node,
        }),
      );
    }
  }

  private getHealthErrorMessage(
    service: 'postgres' | 'redis' | 'elastic',
    error: unknown,
  ): string {
    if (!this.isProduction()) {
      return this.getErrorMessage(error);
    }

    switch (service) {
      case 'postgres':
        return 'Postgres unavailable';
      case 'redis':
        return 'Redis unavailable';
      case 'elastic':
        return 'Elasticsearch unavailable';
    }
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async ensureRedisConnection(): Promise<void> {
    if (['wait', 'end'].includes(this.redis.status)) {
      await this.redis.connect();
    }
  }

  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }
}
