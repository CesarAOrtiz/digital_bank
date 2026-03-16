import { Module } from '@nestjs/common';
import { ACCOUNT_REPOSITORY } from '../../common/infrastructure/repository.tokens';
import { ClientsModule } from '../clients/clients.module';
import { AccountsService } from './application/accounts.service';
import { TypeOrmAccountRepository } from './infrastructure';
import { AccountsResolver } from './presentation';

@Module({
  imports: [ClientsModule],
  providers: [
    AccountsService,
    AccountsResolver,
    {
      provide: ACCOUNT_REPOSITORY,
      useClass: TypeOrmAccountRepository,
    },
  ],
  exports: [AccountsService, ACCOUNT_REPOSITORY],
})
export class AccountsModule {}
