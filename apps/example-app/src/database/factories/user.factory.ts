import { Factory } from '@ackplus/nest-crud';

export class UserFactory {
  @Factory((faker) => faker.internet.email())
  email: string;

  @Factory((faker) => faker.person.firstName())
  firstName: string;

  @Factory((faker) => faker.person.lastName())
  lastName: string;

  @Factory((faker) => faker.internet.password({ length: 12 }))
  password: string;

  @Factory((faker) => faker.datatype.boolean())
  isActive: boolean;

  @Factory((faker) => faker.helpers.arrayElement(['user', 'admin', 'moderator']))
  role: string;
}

