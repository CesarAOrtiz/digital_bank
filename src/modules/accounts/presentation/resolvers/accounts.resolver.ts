import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PaginationInput } from '../../../../common/presentation/inputs/pagination.input';
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
    const account = await this.accountsService.create(input);
    return AccountGraphqlMapper.toModel(account);
  }

  @Query(() => [AccountGraphqlModel], { name: 'accounts' })
  async findAccounts(
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ): Promise<AccountGraphqlModel[]> {
    const accounts = await this.accountsService.findAll(
      pagination?.limit,
      pagination?.offset,
    );
    return accounts.map(AccountGraphqlMapper.toModel);
  }

  @Query(() => AccountGraphqlModel, { name: 'account' })
  async findAccount(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AccountGraphqlModel> {
    const account = await this.accountsService.findOne(id);
    return AccountGraphqlMapper.toModel(account);
  }

  @Query(() => AccountGraphqlModel, { name: 'accountByAccountNumber' })
  async findAccountByAccountNumber(
    @Args('accountNumber') accountNumber: string,
  ): Promise<AccountGraphqlModel> {
    const account =
      await this.accountsService.findByAccountNumber(accountNumber);
    return AccountGraphqlMapper.toModel(account);
  }

  @Query(() => [AccountGraphqlModel], { name: 'accountsByClient' })
  async findAccountsByClient(
    @Args('clientId', { type: () => ID }) clientId: string,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ): Promise<AccountGraphqlModel[]> {
    const accounts = await this.accountsService.findByClient(
      clientId,
      pagination?.limit,
      pagination?.offset,
    );
    return accounts.map(AccountGraphqlMapper.toModel);
  }

  @Query(() => [AccountGraphqlModel], { name: 'searchAccounts' })
  async searchAccounts(
    @Args('term') term: string,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ): Promise<AccountGraphqlModel[]> {
    const accounts = await this.accountsService.search(
      term,
      pagination?.limit,
      pagination?.offset,
    );
    return accounts.map(AccountGraphqlMapper.toModel);
  }
}
