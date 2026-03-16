import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccountsService } from '../../application/accounts.service';
import { CreateAccountInput } from '../inputs/create-account.input';
import { AccountGraphqlMapper } from '../mappers/account-graphql.mapper';
import { AccountGraphqlModel } from '../models/account.model';

@Resolver(() => AccountGraphqlModel)
export class AccountsResolver {
  constructor(private readonly accountsService: AccountsService) {}

  @Mutation(() => AccountGraphqlModel)
  async createAccount(
    @Args('input') input: CreateAccountInput,
  ): Promise<AccountGraphqlModel> {
    return AccountGraphqlMapper.toModel(
      await this.accountsService.create(input),
    );
  }

  @Query(() => [AccountGraphqlModel], { name: 'accounts' })
  async findAccounts(): Promise<AccountGraphqlModel[]> {
    return (await this.accountsService.findAll()).map(
      AccountGraphqlMapper.toModel,
    );
  }

  @Query(() => [AccountGraphqlModel], { name: 'accountsByClient' })
  async findAccountsByClient(
    @Args('clientId', { type: () => ID }) clientId: string,
  ): Promise<AccountGraphqlModel[]> {
    return (await this.accountsService.findByClient(clientId)).map(
      AccountGraphqlMapper.toModel,
    );
  }

  @Query(() => AccountGraphqlModel, { name: 'account' })
  async findAccount(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AccountGraphqlModel> {
    return AccountGraphqlMapper.toModel(await this.accountsService.findOne(id));
  }

  @Query(() => AccountGraphqlModel, { name: 'account' })
  async findAccountByAccountNumber(
    @Args('accountNumber') accountNumber: string,
  ): Promise<AccountGraphqlModel> {
    return AccountGraphqlMapper.toModel(
      await this.accountsService.findByAccountNumber(accountNumber),
    );
  }

  @Query(() => [AccountGraphqlModel], { name: 'searchAccounts' })
  async searchAccounts(
    @Args('term') term: string,
  ): Promise<AccountGraphqlModel[]> {
    return (await this.accountsService.search(term)).map(
      AccountGraphqlMapper.toModel,
    );
  }
}
