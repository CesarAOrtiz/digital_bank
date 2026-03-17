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

@Injectable()
export class AppService {
  constructor(
    @Inject(TYPEORM_DATA_SOURCE) private readonly dataSource: DataSource,
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
        indicator.down({ message: this.getErrorMessage(error) }),
      );
    }
  }

  async checkRedis(): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check('redis');
    const redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT ?? 6379),
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 3000,
    });
    let lastError: Error | null = null;

    redis.on('error', (error) => {
      lastError = error;
    });

    try {
      await redis.connect();
      const result = await redis.ping();
      if (result !== 'PONG') {
        throw new Error(`Unexpected Redis ping response: ${result}`);
      }

      return indicator.up();
    } catch (error) {
      const rootCause = lastError ?? (error instanceof Error ? error : null);
      throw new HealthCheckError(
        'Redis check failed',
        indicator.down({
          message: this.getErrorMessage(rootCause ?? error),
        }),
      );
    } finally {
      redis.disconnect();
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
        indicator.down({ message: this.getErrorMessage(error), node }),
      );
    }
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
