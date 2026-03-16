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
    return (await this.accountsService.findAll()).map((account) =>
      AccountGraphqlMapper.toModel(account),
    );
  }

  @Query(() => AccountGraphqlModel, { name: 'account' })
  async findAccount(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AccountGraphqlModel> {
    return AccountGraphqlMapper.toModel(await this.accountsService.findOne(id));
  }
}
