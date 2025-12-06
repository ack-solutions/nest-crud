import { Factory } from '@ackplus/nest-crud';

export class PostFactory {
  @Factory((faker) => faker.lorem.sentence())
  title: string;

  @Factory((faker) => faker.lorem.paragraphs(3))
  content: string;

  @Factory((faker) => faker.helpers.arrayElement(['draft', 'published', 'archived']))
  status: string;

  @Factory((faker) => faker.number.int({ min: 0, max: 1000 }))
  viewCount: number;

  @Factory((faker) => faker.datatype.boolean())
  published: boolean;

  // authorId will be provided when generating
}

