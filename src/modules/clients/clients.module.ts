import { Module } from '@nestjs/common';
import { CLIENT_REPOSITORY } from '../../common/infrastructure/repository.tokens';
import { ClientsService } from './application/services/clients.service';
import { ClientCacheService } from './application/services/client-cache.service';
import { ClientReadService } from './application/services/client-read.service';
import { CreateClientUseCase } from './application/use-cases/create-client.use-case';
import { TypeOrmClientRepository } from './infrastructure';
import { ClientsResolver } from './presentation';

@Module({
  providers: [
    ClientCacheService,
    ClientReadService,
    CreateClientUseCase,
    ClientsService,
    ClientsResolver,
    {
      provide: CLIENT_REPOSITORY,
      useClass: TypeOrmClientRepository,
    },
  ],
  exports: [ClientsService, CLIENT_REPOSITORY],
})
export class ClientsModule {}
