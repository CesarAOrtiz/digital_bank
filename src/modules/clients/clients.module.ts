import { Module } from '@nestjs/common';
import { CLIENT_REPOSITORY } from '../../common/infrastructure/repository.tokens';
import { ClientsService } from './application/clients.service';
import { TypeOrmClientRepository } from './infrastructure';
import { ClientsResolver } from './presentation';

@Module({
  providers: [
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
