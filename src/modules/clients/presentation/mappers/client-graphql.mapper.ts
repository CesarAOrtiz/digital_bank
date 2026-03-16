import { Client } from '../../domain';
import { ClientGraphqlModel } from '../models/client.model';

export class ClientGraphqlMapper {
  static toModel(client: Client): ClientGraphqlModel {
    return Object.assign(new ClientGraphqlModel(), client.toPrimitives());
  }
}
