import { Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';

import { Crud } from '../../lib/decorator/crud.decorator';
import { CrudService } from '../../lib/service/crud-service';
import { BaseEntity } from '../../lib/base-entity';
import { User } from '../helper/entities/user-test.entity';
import { Profile } from '../helper/entities/profile-test.entity';
import { Post } from '../helper/entities/post-test.entity';
import { Comment } from '../helper/entities/comment-test.entity';
import { ProfileAddress } from '../helper/entities/profile-address-test.entity';
import { Country } from '../helper/entities/country-test.entity';
import { OrderedItem } from '../helper/entities/ordered-item-test.entity';

const entities = [User, Profile, Post, Comment, ProfileAddress, Country, OrderedItem];

/**
 * A base controller that adds shared endpoints to EVERY @Crud controller that
 * extends it — the "add a fresh endpoint for every CRUD" pattern.
 *
 * Inherited routes register and work, and `this.service` resolves to the child's
 * service. The one rule: give shared routes a **multi-segment path** (e.g.
 * `summary/info`), because inherited routes register *after* the generated ones,
 * so a single-segment path like `ping` would be captured by the generated `/:id`.
 */
abstract class BaseSharedController<T extends BaseEntity> {
  abstract service: CrudService<T>;

  // ✅ multi-segment path — safe from the generated `/:id`
  @Get('summary/info')
  info() {
    return { entity: this.service.repository.metadata.name };
  }

  // ⚠️ single-segment path — shadowed by the generated `/:id` (findOne)
  @Get('ping')
  ping() {
    return { pong: true };
  }
}

@Crud({ entity: User, path: 'users', routes: { findMany: { enabled: true }, findOne: { enabled: true } } })
class UserController extends BaseSharedController<User> {
  constructor(public service: CrudService<User>) {
    super();
  }
}

describe('Base controller — a shared endpoint on every CRUD resource', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({ type: 'sqljs', autoSave: false, entities, synchronize: true, logging: false } as any),
        TypeOrmModule.forFeature(entities),
      ],
      controllers: [UserController],
      providers: [
        {
          provide: CrudService,
          useFactory: (ds: DataSource) => new CrudService<User>(ds.getRepository(User)),
          inject: [DataSource],
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves an inherited base route (multi-segment) under the controller path', async () => {
    const res = await request(app.getHttpServer()).get('/users/summary/info').expect(200);
    expect(res.body).toEqual({ entity: 'User' }); // `this.service` resolves to the child's service
  });

  it('the generated CRUD route works alongside the inherited one', async () => {
    const res = await request(app.getHttpServer()).get('/users').expect(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
  });

  it('documents the caveat: a single-segment inherited route is shadowed by /:id', async () => {
    // `/users/ping` is captured by the generated findOne(`/:id`) → 404, NOT the base `ping()`.
    // This is why shared base routes must use a multi-segment path.
    await request(app.getHttpServer()).get('/users/ping').expect(404);
  });
});
