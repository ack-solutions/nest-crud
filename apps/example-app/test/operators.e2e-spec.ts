import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { QueryBuilder, WhereOperatorEnum as Op, OrderDirectionEnum as Dir } from '@ackplus/nest-crud-request';

import { bootstrapPgApp, describePg, truncateAll } from './pg-setup';

/**
 * Operator-by-operator + edge-case coverage against real Postgres, driven by the
 * client QueryBuilder. Deterministic 6-user seed (Frank has a NULL age; Alice + Bob
 * have posts):
 *
 *   name   age   role    active  lastName  email
 *   Alice  20    admin   true    Smith     alice@acme.com   (2 posts)
 *   Bob    30    user    true    Jones     bob@acme.io      (1 post)
 *   Carol  40    user    false   Smith     carol@beta.com
 *   Dave   50    editor  true    Brown     dave@beta.io
 *   Erin   25    admin   true    Jones     erin@acme.com
 *   Frank  null  user    false   Brown     frank@beta.com
 */
describePg('Operators & edge cases (real Postgres, via QueryBuilder)', () => {
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
    const rows = [
      { email: 'alice@acme.com', firstName: 'Alice', lastName: 'Smith', age: 20, role: 'admin', isActive: true, password: 'p' },
      { email: 'bob@acme.io', firstName: 'Bob', lastName: 'Jones', age: 30, role: 'user', isActive: true, password: 'p' },
      { email: 'carol@beta.com', firstName: 'Carol', lastName: 'Smith', age: 40, role: 'user', isActive: false, password: 'p' },
      { email: 'dave@beta.io', firstName: 'Dave', lastName: 'Brown', age: 50, role: 'editor', isActive: true, password: 'p' },
      { email: 'erin@acme.com', firstName: 'Erin', lastName: 'Jones', age: 25, role: 'admin', isActive: true, password: 'p' },
      { email: 'frank@beta.com', firstName: 'Frank', lastName: 'Brown', age: null, role: 'user', isActive: false, password: 'p' },
    ];
    const users = (await http().post('/users/bulk').send({ bulk: rows }).expect(201)).body;
    const byName = (n: string) => users.find((u: any) => u.firstName === n).id;
    await http().post('/posts/bulk').send({
      bulk: [
        { title: 'a1', content: '.', status: 'published', likes: 10, authorId: byName('Alice') },
        { title: 'a2', content: '.', status: 'draft', likes: 5, authorId: byName('Alice') },
        { title: 'b1', content: '.', status: 'published', likes: 20, authorId: byName('Bob') },
      ],
    }).expect(201);
  }

  /** Run a QueryBuilder and return the sorted firstNames. */
  async function names(qb: QueryBuilder): Promise<string[]> {
    const res = await http().get('/users').query(qb.toObject() as any).expect(200);
    return res.body.items.map((u: any) => u.firstName).sort();
  }

  describe('comparison', () => {
    it('$eq / $ne', async () => {
      expect(await names(new QueryBuilder().where('role', Op.EQ, 'admin'))).toEqual(['Alice', 'Erin']);
      expect(await names(new QueryBuilder().where('role', Op.NOT_EQ, 'user'))).toEqual(['Alice', 'Dave', 'Erin']);
    });

    it('$gt / $gte / $lt / $lte', async () => {
      expect(await names(new QueryBuilder().where('age', Op.GT, 30))).toEqual(['Carol', 'Dave']);
      expect(await names(new QueryBuilder().where('age', Op.GT_OR_EQ, 30))).toEqual(['Bob', 'Carol', 'Dave']);
      expect(await names(new QueryBuilder().where('age', Op.LT, 30))).toEqual(['Alice', 'Erin']);
      expect(await names(new QueryBuilder().where('age', Op.LT_OR_EQ, 25))).toEqual(['Alice', 'Erin']);
    });

    it('$between / $notBetween (NULL age excluded from both)', async () => {
      expect(await names(new QueryBuilder().where('age', Op.BETWEEN, [25, 40]))).toEqual(['Bob', 'Carol', 'Erin']);
      expect(await names(new QueryBuilder().where('age', Op.NOT_BETWEEN, [25, 40]))).toEqual(['Alice', 'Dave']);
    });
  });

  describe('membership', () => {
    it('$in / $notIn', async () => {
      expect(await names(new QueryBuilder().where('role', Op.IN, ['admin', 'editor']))).toEqual(['Alice', 'Dave', 'Erin']);
      expect(await names(new QueryBuilder().where('role', Op.NOT_IN, ['user']))).toEqual(['Alice', 'Dave', 'Erin']);
    });

    it('$inL — case-insensitive IN', async () => {
      expect(await names(new QueryBuilder().where('lastName', Op.IN_L, ['SMITH']))).toEqual(['Alice', 'Carol']);
    });
  });

  describe('pattern matching', () => {
    it('$like (case-sensitive) vs $iLike (case-insensitive)', async () => {
      expect(await names(new QueryBuilder().where('firstName', Op.LIKE, '%a%'))).toEqual(['Carol', 'Dave', 'Frank']);
      expect(await names(new QueryBuilder().where('firstName', Op.ILIKE, '%A%'))).toEqual(['Alice', 'Carol', 'Dave', 'Frank']);
    });

    it('$startsWith / $endsWith / $iStartsWith', async () => {
      expect(await names(new QueryBuilder().where('firstName', Op.STARTS_WITH, 'C'))).toEqual(['Carol']);
      expect(await names(new QueryBuilder().where('email', Op.ENDS_WITH, '.com'))).toEqual(['Alice', 'Carol', 'Erin', 'Frank']);
      expect(await names(new QueryBuilder().where('firstName', Op.ISTARTS_WITH, 'al'))).toEqual(['Alice']);
    });
  });

  describe('null / boolean / case-insensitive equality', () => {
    it('$isNull / $isNotNull', async () => {
      expect(await names(new QueryBuilder().where('age', Op.IS_NULL, true))).toEqual(['Frank']);
      expect(await names(new QueryBuilder().where('age', Op.IS_NOT_NULL, true))).toEqual(['Alice', 'Bob', 'Carol', 'Dave', 'Erin']);
    });

    it('$isTrue / $isFalse', async () => {
      expect(await names(new QueryBuilder().where('isActive', Op.IS_TRUE, true))).toEqual(['Alice', 'Bob', 'Dave', 'Erin']);
      expect(await names(new QueryBuilder().where('isActive', Op.IS_FALSE, true))).toEqual(['Carol', 'Frank']);
    });

    it('$ieq — case-insensitive equality', async () => {
      expect(await names(new QueryBuilder().where('firstName', Op.IEQ, 'ALICE'))).toEqual(['Alice']);
    });
  });

  describe('relation existence', () => {
    it('$exists / $notExists', async () => {
      expect(await names(new QueryBuilder().where('posts', Op.EXISTS, true))).toEqual(['Alice', 'Bob']);
      expect(await names(new QueryBuilder().where('posts', Op.NOT_EXISTS, true))).toEqual(['Carol', 'Dave', 'Erin', 'Frank']);
    });
  });

  describe('logical nesting', () => {
    it('(role=admin OR age>40) AND isActive', async () => {
      const qb = new QueryBuilder()
        .where((b) => {
          b.orWhere('role', 'admin');
          b.orWhere('age', Op.GT, 40);
        })
        .andWhere('isActive', Op.IS_TRUE, true);
      expect(await names(qb)).toEqual(['Alice', 'Dave', 'Erin']);
    });
  });

  describe('ordering & pagination', () => {
    it('multi-column order (lastName ASC, firstName ASC)', async () => {
      const res = await http().get('/users').query(
        new QueryBuilder().addOrder('lastName', Dir.ASC).addOrder('firstName', Dir.ASC).toObject() as any,
      ).expect(200);
      expect(res.body.items.map((u: any) => u.firstName)).toEqual(['Dave', 'Frank', 'Bob', 'Erin', 'Alice', 'Carol']);
    });

    it('paginates: stable total, page window, and skip beyond the end', async () => {
      const base = () => new QueryBuilder().addOrder('age', Dir.ASC).setTake(2);
      const p1 = (await http().get('/users').query(base().setSkip(0).toObject() as any).expect(200)).body;
      const p2 = (await http().get('/users').query(base().setSkip(2).toObject() as any).expect(200)).body;
      const past = (await http().get('/users').query(base().setSkip(100).toObject() as any).expect(200)).body;

      expect([p1.total, p2.total, past.total]).toEqual([6, 6, 6]); // total ignores the window
      expect(p1.items).toHaveLength(2);
      expect(p2.items).toHaveLength(2);
      expect(past.items).toHaveLength(0); // skipped past the end → empty page, total intact
      // ages ascending across pages (NULL age sorts last in Postgres, so not on early pages)
      expect(p1.items.map((u: any) => u.age)).toEqual([20, 25]);
      expect(p2.items.map((u: any) => u.age)).toEqual([30, 40]);
    });
  });

  describe('validation', () => {
    it('rejects an unknown filter field with 400', async () => {
      await http().get('/users').query({ where: JSON.stringify({ notAColumn: 1 }) }).expect(400);
    });
  });
});
