import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly appService: AppService,
  ) {}

  @Get('health')
  @HealthCheck()
  async getHealth() {
    return this.healthCheckService.check([
      async (): Promise<HealthIndicatorResult> =>
        this.appService.checkPostgres(),
      async (): Promise<HealthIndicatorResult> => this.appService.checkRedis(),
      async (): Promise<HealthIndicatorResult> =>
        this.appService.checkElastic(),
    ]);
  }
}
