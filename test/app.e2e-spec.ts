import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';
import request from 'supertest';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn().mockResolvedValue({
              status: 'ok',
              info: {
                postgres: { status: 'up' },
                redis: { status: 'up' },
                elastic: { status: 'up' },
              },
              error: {},
              details: {
                postgres: { status: 'up' },
                redis: { status: 'up' },
                elastic: { status: 'up' },
              },
            }),
          },
        },
        {
          provide: AppService,
          useValue: {
            checkPostgres: jest.fn().mockResolvedValue({ postgres: { status: 'up' } }),
            checkRedis: jest.fn().mockResolvedValue({ redis: { status: 'up' } }),
            checkElastic: jest.fn().mockResolvedValue({ elastic: { status: 'up' } }),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health debe devolver el estado agregado', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          status: 'ok',
          info: {
            postgres: { status: 'up' },
            redis: { status: 'up' },
            elastic: { status: 'up' },
          },
          error: {},
          details: {
            postgres: { status: 'up' },
            redis: { status: 'up' },
            elastic: { status: 'up' },
          },
        });
      });
  });
});
