import { Module } from '@nestjs/common';
import { ACCOUNT_REPOSITORY } from '../../common/infrastructure/repository.tokens';
import { ClientsModule } from '../clients/clients.module';
import { AccountsService } from './application/services/accounts.service';
import { AccountReadService } from './application/services/account-read.service';
import { ClientAccountsCacheService } from './application/services/client-accounts-cache.service';
import { CreateAccountUseCase } from './application/use-cases/create-account.use-case';
import { TypeOrmAccountRepository } from './infrastructure';
import { AccountsResolver } from './presentation';

@Module({
  imports: [ClientsModule],
  providers: [
    TypeOrmAccountRepository,
    ClientAccountsCacheService,
    AccountReadService,
    CreateAccountUseCase,
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
