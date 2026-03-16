import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
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
    return ClientGraphqlMapper.toModel(await this.clientsService.create(input));
  }

  @Query(() => [ClientGraphqlModel], { name: 'clients' })
  async findClients(): Promise<ClientGraphqlModel[]> {
    return (await this.clientsService.findAll()).map(
      ClientGraphqlMapper.toModel,
    );
  }

  @Query(() => [ClientGraphqlModel], { name: 'searchClients' })
  async searchClients(
    @Args('term') term: string,
  ): Promise<ClientGraphqlModel[]> {
    return (await this.clientsService.search(term)).map(
      ClientGraphqlMapper.toModel,
    );
  }

  @Query(() => ClientGraphqlModel, { name: 'client' })
  async findClient(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ClientGraphqlModel> {
    return ClientGraphqlMapper.toModel(await this.clientsService.findOne(id));
  }
}
