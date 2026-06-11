import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import {
  QueryBuilder,
  WhereOperatorEnum,
  OrderDirectionEnum,
  AggregateFnEnum,
} from '@ackplus/nest-crud-request';

import { bootstrapPgApp, describePg, truncateAll } from './pg-setup';

/**
 * Complex, multi-feature queries built with the **client `QueryBuilder`** and run
 * against real Postgres — the full round-trip: builder → query string → server →
 * DB. Each test combines several concerns (filter + search + sort + pagination +
 * relations + aggregates + select) in one request, the way a real UI would.
 *
 * Seed: 10 users (User01..User10), ages 21..30, lastName Alpha (1-5) / Beta (6-10),
 * role user (odd) / admin (even), all active except User10. Posts: User01 has 3
 * (likes 10/20/30), User02 has 2 (10/20), User03 has 1 (10); the rest have none.
 */
describePg('Complex queries via QueryBuilder (real Postgres)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, ds } = await bootstrapPgApp());
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await truncateAll(ds);
    await seed();
  });

  async function seed() {
    const seedUsers = Array.from({ length: 10 }, (_, k) => {
      const i = k + 1;
      return {
        email: `u${i}@e.com`,
        firstName: `User${String(i).padStart(2, '0')}`,
        lastName: i <= 5 ? 'Alpha' : 'Beta',
        password: 'p',
        age: 20 + i,
        role: i % 2 ? 'user' : 'admin',
        isActive: i !== 10,
      };
    });
    const users = (await http().post('/users/bulk').send({ bulk: seedUsers }).expect(201)).body;

    const counts = [3, 2, 1]; // posts for User01 / User02 / User03
    const posts: any[] = [];
    counts.forEach((count, u) => {
      for (let p = 0; p < count; p++) {
        posts.push({ title: `P${u}-${p}`, content: '.', status: 'published', likes: (p + 1) * 10, authorId: users[u].id });
      }
    });
    await http().post('/posts/bulk').send({ bulk: posts }).expect(201);
    return users;
  }

  /** Run a QueryBuilder against GET /users and return the body. */
  async function runUsers(qb: QueryBuilder) {
    const res = await http().get('/users').query(qb.toObject() as any).expect(200);
    return res.body as { items: any[]; total: number };
  }

  it('filter + search + sort + paginate in one request', async () => {
    const qb = new QueryBuilder()
      .where('role', 'user')                                    // filter
      .andWhere('age', WhereOperatorEnum.GT_OR_EQ, 23)          // filter
      .andWhere('firstName', WhereOperatorEnum.ILIKE, '%user%') // search
      .addOrder('age', OrderDirectionEnum.DESC)                 // sort
      .setTake(2)
      .setSkip(0);                                              // paginate

    const body = await runUsers(qb);

    // role=user → User01/03/05/07/09; age>=23 → 03/05/07/09; total 4.
    expect(body.total).toBe(4);
    // age DESC, first page of 2 → User09 (29), User07 (27).
    expect(body.items.map((u) => u.firstName)).toEqual(['User09', 'User07']);
    expect(body.items.every((u) => u.role === 'user' && u.age >= 23)).toBe(true);
  });

  it('pagination is consistent: stable total, disjoint contiguous pages', async () => {
    const qb = new QueryBuilder()
      .where('isActive', WhereOperatorEnum.IS_TRUE, true)
      .addOrder('age', OrderDirectionEnum.ASC)
      .setTake(4);

    const page1 = await runUsers(qb.setSkip(0));
    const page2 = await runUsers(qb.setSkip(4));

    expect(page1.total).toBe(9); // only User10 is inactive
    expect(page2.total).toBe(9);
    expect(page1.items).toHaveLength(4);
    expect(page2.items).toHaveLength(4);

    const ids1 = page1.items.map((u) => u.id);
    const ids2 = page2.items.map((u) => u.id);
    expect(ids1.filter((id) => ids2.includes(id))).toHaveLength(0); // no overlap
    // contiguous ascending: every age on page 1 is below every age on page 2
    expect(Math.max(...page1.items.map((u) => u.age))).toBeLessThan(Math.min(...page2.items.map((u) => u.age)));
  });

  it('operators combined: $in + $between + $ne, ordered', async () => {
    const qb = new QueryBuilder()
      .where('role', WhereOperatorEnum.IN, ['user', 'admin'])
      .andWhere('age', WhereOperatorEnum.BETWEEN, [23, 28])
      .andWhere('lastName', WhereOperatorEnum.NOT_EQ, 'Beta')
      .addOrder('email', OrderDirectionEnum.ASC);

    const body = await runUsers(qb);

    // age 23..28 → User03..User08; lastName != Beta → User01..User05; intersection → 03/04/05.
    expect(body.total).toBe(3);
    expect(body.items.map((u) => u.firstName)).toEqual(['User03', 'User04', 'User05']);
  });

  it('grouped OR + select + relations + aggregates + having + multi-sort', async () => {
    const qb = new QueryBuilder()
      .where((b) => {
        // (role = admin OR age < 24) — both as orWhere so they form one $or group.
        b.orWhere('role', 'admin');
        b.orWhere('age', WhereOperatorEnum.LT, 24);
      })
      .addSelect(['firstName', 'age'])
      .addRelation('posts', ['title'])
      .addAggregate({ fn: AggregateFnEnum.COUNT, field: 'posts.id', as: 'postCount' })
      .addAggregate({ fn: AggregateFnEnum.SUM, field: 'posts.likes', as: 'likesSum' })
      .having('postCount', WhereOperatorEnum.GT_OR_EQ, 1)
      .addOrder('postCount', OrderDirectionEnum.DESC)
      .addOrder('age', OrderDirectionEnum.ASC)
      .setTake(5);

    const body = await runUsers(qb);

    // Only User01/02/03 have posts. Group: role=admin OR age<24 → User02(admin),
    // User01(age21<24), User03(age23<24) all qualify; having postCount>=1 keeps all 3.
    expect(body.total).toBe(3);
    expect(body.items.map((u) => u.firstName)).toEqual(['User01', 'User02', 'User03']);
    expect(body.items.map((u) => Number(u.postCount))).toEqual([3, 2, 1]);
    expect(body.items.map((u) => Number(u.likesSum))).toEqual([60, 30, 10]);

    // select honoured (firstName/age kept, email dropped) but pk + relation still present.
    const top = body.items[0];
    expect(top.id).toBeDefined();
    expect(top.firstName).toBe('User01');
    expect(top.email).toBeUndefined();
    expect(top.posts).toHaveLength(3);
  });

  it('search-only: case-insensitive prefix + sort + page', async () => {
    const qb = new QueryBuilder()
      .where('firstName', WhereOperatorEnum.ISTARTS_WITH, 'user0') // User01..User09
      .addOrder('firstName', OrderDirectionEnum.ASC)
      .setTake(3)
      .setSkip(0);

    const body = await runUsers(qb);

    expect(body.total).toBe(9); // User01..User09 (User10 is "User10", not "User0*")
    expect(body.items.map((u) => u.firstName)).toEqual(['User01', 'User02', 'User03']);
  });
});
