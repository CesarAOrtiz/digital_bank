import { Module } from '@nestjs/common';
import { ACCOUNT_REPOSITORY } from '../../common/infrastructure/repository.tokens';
import { ClientsModule } from '../clients/clients.module';
import { AccountsService } from './application/accounts.service';
import { TypeOrmAccountRepository } from './infrastructure';
import { AccountsResolver } from './presentation';

@Module({
  imports: [ClientsModule],
  providers: [
    TypeOrmAccountRepository,
    AccountsService,
    AccountsResolver,
    {
      provide: ACCOUNT_REPOSITORY,
      useExisting: TypeOrmAccountRepository,
    },
  ],
  exports: [AccountsService, ACCOUNT_REPOSITORY, TypeOrmAccountRepository],
})
export class AccountsModule {}
