import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { TransactionsService } from '../../application/services/transactions.service';
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
  async deposit(
    @Args('input') input: DepositInput,
  ): Promise<TransactionGraphqlModel> {
    const transaction = await this.transactionsService.deposit(input);
    return TransactionGraphqlMapper.toModel(transaction);
  }

  @Mutation(() => TransactionGraphqlModel)
  async withdraw(
    @Args('input') input: WithdrawalInput,
  ): Promise<TransactionGraphqlModel> {
    const transaction = await this.transactionsService.withdraw(input);
    return TransactionGraphqlMapper.toModel(transaction);
  }

  @Mutation(() => TransactionGraphqlModel)
  async transfer(
    @Args('input') input: TransferInput,
  ): Promise<TransactionGraphqlModel> {
    const transaction = await this.transactionsService.transfer(input);
    return TransactionGraphqlMapper.toModel(transaction);
  }

  @Query(() => [TransactionGraphqlModel], { name: 'transactions' })
  async findTransactions(): Promise<TransactionGraphqlModel[]> {
    const transactions = await this.transactionsService.findAll();
    return transactions.map(TransactionGraphqlMapper.toModel);
  }

  @Query(() => TransactionGraphqlModel, { name: 'transaction' })
  async findTransaction(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<TransactionGraphqlModel> {
    const transaction = await this.transactionsService.findOne(id);
    return TransactionGraphqlMapper.toModel(transaction);
  }

  @Query(() => [TransactionGraphqlModel], { name: 'searchTransactions' })
  async searchTransactions(
    @Args('filters', { nullable: true }) filters?: SearchTransactionsInput,
  ) {
    const transactions = await this.transactionsService.search(filters ?? {});
    return transactions.map(TransactionGraphqlMapper.toModel);
  }
}
