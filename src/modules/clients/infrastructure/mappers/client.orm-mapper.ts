import { Client } from '../../domain';
import { ClientOrmEntity } from '../entities/client.orm-entity';

export class ClientOrmMapper {
  static toDomain(entity: ClientOrmEntity): Client {
    return new Client({ ...entity });
  }

  static toOrm(client: Client): ClientOrmEntity {
    return Object.assign(new ClientOrmEntity(), client.toPrimitives());
  }
}
