import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PaginationInput } from '../../../../common/presentation/inputs/pagination.input';
import { ClientsService } from '../../application/clients.service';
import { CreateClientInput } from '../inputs/create-client.input';
import { ClientGraphqlMapper } from '../mappers/client-graphql.mapper';
import { ClientGraphqlModel } from '../models/client.model';

@Resolver(() => ClientGraphqlModel)
export class ClientsResolver {
  constructor(private readonly clientsService: ClientsService) {}

  @Mutation(() => ClientGraphqlModel)
  async createClient(
    @Args('input') input: CreateClientInput,
  ): Promise<ClientGraphqlModel> {
    const client = await this.clientsService.create(input);
    return ClientGraphqlMapper.toModel(client);
  }

  @Query(() => [ClientGraphqlModel], { name: 'clients' })
  async findClients(
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ): Promise<ClientGraphqlModel[]> {
    const clients = await this.clientsService.findAll(
      pagination?.limit,
      pagination?.offset,
    );
    return clients.map(ClientGraphqlMapper.toModel);
  }

  @Query(() => ClientGraphqlModel, { name: 'client' })
  async findClient(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ClientGraphqlModel> {
    const client = await this.clientsService.findOne(id);
    return ClientGraphqlMapper.toModel(client);
  }

  @Query(() => [ClientGraphqlModel], { name: 'searchClients' })
  async searchClients(
    @Args('term') term: string,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ): Promise<ClientGraphqlModel[]> {
    const clients = await this.clientsService.search(
      term,
      pagination?.limit,
      pagination?.offset,
    );
    return clients.map(ClientGraphqlMapper.toModel);
  }
}
