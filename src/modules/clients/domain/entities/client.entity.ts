import type { ClientProps } from '../types/client.props';

export class Client {
  constructor(private readonly props: ClientProps) {}

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get documentNumber(): string {
    return this.props.documentNumber;
  }

  toPrimitives(): ClientProps {
    return { ...this.props };
  }
}
