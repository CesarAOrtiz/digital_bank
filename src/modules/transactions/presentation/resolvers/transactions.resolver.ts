import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { TransactionsService } from '../../application/transactions.service';
import { DepositInput } from '../inputs/deposit.input';
import { SearchTransactionsInput } from '../inputs/search-transactions.input';
import { TransferInput } from '../inputs/transfer.input';
import { WithdrawalInput } from '../inputs/withdrawal.input';
import { TransactionGraphqlMapper } from '../mappers/transaction-graphql.mapper';
import { TransactionGraphqlModel } from '../models/transaction.model';

@Resolver(() => TransactionGraphqlModel)
export class TransactionsResolver {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Mutation(() => TransactionGraphqlModel)
  async deposit(@Args('input') input: DepositInput): Promise<TransactionGraphqlModel> {
    return TransactionGraphqlMapper.toModel(await this.transactionsService.deposit(input));
  }

  @Mutation(() => TransactionGraphqlModel)
  async withdraw(@Args('input') input: WithdrawalInput): Promise<TransactionGraphqlModel> {
    return TransactionGraphqlMapper.toModel(await this.transactionsService.withdraw(input));
  }

  @Mutation(() => TransactionGraphqlModel)
  async transfer(@Args('input') input: TransferInput): Promise<TransactionGraphqlModel> {
    return TransactionGraphqlMapper.toModel(await this.transactionsService.transfer(input));
  }

  @Query(() => [TransactionGraphqlModel], { name: 'transactions' })
  async findTransactions(): Promise<TransactionGraphqlModel[]> {
    return (await this.transactionsService.findAll()).map((transaction) =>
      TransactionGraphqlMapper.toModel(transaction),
    );
  }

  @Query(() => [TransactionGraphqlModel], { name: 'searchTransactions' })
  async searchTransactions(@Args('filters', { nullable: true }) filters?: SearchTransactionsInput) {
    return (await this.transactionsService.search(filters ?? {})).map((transaction) =>
      TransactionGraphqlMapper.toModel(transaction),
    );
  }

  @Query(() => TransactionGraphqlModel, { name: 'transaction' })
  async findTransaction(@Args('id', { type: () => ID }) id: string): Promise<TransactionGraphqlModel> {
    return TransactionGraphqlMapper.toModel(await this.transactionsService.findOne(id));
  }
}
