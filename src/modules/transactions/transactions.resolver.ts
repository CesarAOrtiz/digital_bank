import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { TransactionsService } from './transactions.service';
import { Transaction } from './entities/transaction.entity';
import { CreateTransactionInput } from './dto/create-transaction.input';
import { UpdateTransactionInput } from './dto/update-transaction.input';

@Resolver(() => Transaction)
export class TransactionsResolver {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Mutation(() => Transaction)
  createTransaction(@Args('createTransactionInput') createTransactionInput: CreateTransactionInput) {
    return this.transactionsService.create(createTransactionInput);
  }

  @Query(() => [Transaction], { name: 'transactions' })
  findAll() {
    return this.transactionsService.findAll();
  }

  @Query(() => Transaction, { name: 'transaction' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.transactionsService.findOne(id);
  }

  @Mutation(() => Transaction)
  updateTransaction(@Args('updateTransactionInput') updateTransactionInput: UpdateTransactionInput) {
    return this.transactionsService.update(updateTransactionInput.id, updateTransactionInput);
  }

  @Mutation(() => Transaction)
  removeTransaction(@Args('id', { type: () => Int }) id: number) {
    return this.transactionsService.remove(id);
  }
}
