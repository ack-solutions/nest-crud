import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';

import { CrudSaveContext, CrudService } from '@ackplus/nest-crud';

import { User } from '../src/database/entities/user.entity';
import { bootstrapPgApp, describePg, truncateAll } from './pg-setup';

/**
 * End-to-end tests against a REAL Postgres database. Unlike the package's sql.js
 * tests, these validate the full stack on a production-grade DB (real soft-delete
 * timestamps, `$iLike` / `$isTrue` / `$isFalse`, transactions, case-sensitivity).
 *
 * Opt-in via env (see ./pg-setup). Runs `describe.skip` without a configured DB.
 */
describePg('Postgres e2e (real database)', () => {
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
  });

  /** Create the base dataset entirely through the generated CRUD endpoints. */
  async function seed() {
    const usersRes = await http()
      .post('/users/bulk')
      .send({
        bulk: [
          { email: 'alice@e.com', firstName: 'Alice', lastName: 'A', password: 'h1', age: 30, role: 'admin', isActive: true },
          { email: 'bob@e.com', firstName: 'Bob', lastName: 'B', password: 'h2', age: 25, role: 'user', isActive: true },
          { email: 'carol@e.com', firstName: 'Carol', lastName: 'C', password: 'h3', age: 40, role: 'user', isActive: false },
        ],
      })
      .expect(201);
    const [alice, bob, carol] = usersRes.body;

    await http()
      .post('/posts/bulk')
      .send({
        bulk: [
          { title: 'Alice 1', content: '...', status: 'published', likes: 10, authorId: alice.id },
          { title: 'Alice 2', content: '...', status: 'draft', likes: 5, authorId: alice.id },
          { title: 'Bob 1', content: '...', status: 'published', likes: 20, authorId: bob.id },
        ],
      })
      .expect(201);

    return { alice, bob, carol };
  }

  describe('create + find + filter', () => {
    it('bulk-creates via our CRUD function and lists them', async () => {
      await seed();
      const res = await http().get('/users').expect(200);
      expect(res.body.total).toBe(3);
      expect(res.body.items).toHaveLength(3);
    });

    it('filters with operators ($gte, $iLike, $in)', async () => {
      await seed();
      const byAge = await http().get('/users').query({ where: JSON.stringify({ age: { $gte: 30 } }) }).expect(200);
      expect(byAge.body.items.map((u: any) => u.firstName).sort()).toEqual(['Alice', 'Carol']);

      const search = await http().get('/users').query({ where: JSON.stringify({ firstName: { $iLike: '%ALI%' } }) }).expect(200);
      expect(search.body.items.map((u: any) => u.firstName)).toEqual(['Alice']);

      const roles = await http().get('/users').query({ where: JSON.stringify({ role: { $in: ['admin'] } }) }).expect(200);
      expect(roles.body.total).toBe(1);
    });

    it('joins relations and respects nested data', async () => {
      const { alice } = await seed();
      const res = await http().get('/users').query({
        where: JSON.stringify({ id: alice.id }),
        relations: JSON.stringify(['posts']),
      }).expect(200);
      expect(res.body.items[0].posts).toHaveLength(2);
    });
  });

  describe('aggregates + having + counts', () => {
    it('count + sum over posts, ordered by the alias', async () => {
      await seed();
      const res = await http().get('/users').query({
        aggregates: JSON.stringify([
          { fn: 'count', field: 'posts.id', as: 'postCount' },
          { fn: 'sum', field: 'posts.likes', as: 'likesSum' },
        ]),
        order: JSON.stringify({ postCount: 'DESC' }),
      }).expect(200);

      const got = res.body.items.map((u: any) => [u.firstName, Number(u.postCount), Number(u.likesSum)]);
      expect(got).toEqual([['Alice', 2, 15], ['Bob', 1, 20], ['Carol', 0, 0]]);
    });

    it('having filters on the aggregate alias', async () => {
      await seed();
      const res = await http().get('/users').query({
        aggregates: JSON.stringify([{ fn: 'count', field: 'posts.id', as: 'postCount' }]),
        having: JSON.stringify({ postCount: { $gt: 0 } }),
      }).expect(200);
      expect(res.body.total).toBe(2);
      expect(res.body.items.map((u: any) => u.firstName).sort()).toEqual(['Alice', 'Bob']);
    });

    it('counts grouped by a column', async () => {
      await seed();
      const res = await http().get('/users/get/counts').query({ groupByKey: 'role' }).expect(200);
      const data = res.body.data.map((d: any) => [d.role, Number(d.count)]).sort();
      expect(data).toEqual([['admin', 1], ['user', 2]]);
    });
  });

  describe('hidden fields & relations (security)', () => {
    it('drops the hidden column and rejects hidden where / relations', async () => {
      await seed();
      const sel = await http().get('/users').query({ select: JSON.stringify(['email', 'password']) }).expect(200);
      expect(sel.body.items[0].password).toBeUndefined();

      await http().get('/users').query({ where: JSON.stringify({ password: { $eq: 'h1' } }) }).expect(400);
      await http().get('/users').query({ relations: JSON.stringify(['auditLogs']) }).expect(400);
    });
  });

  describe('postgres-specific boolean operators', () => {
    it('$isTrue / $isFalse on a real boolean column', async () => {
      await seed();
      const active = await http().get('/users').query({ where: JSON.stringify({ isActive: { $isTrue: true } }) }).expect(200);
      expect(active.body.items.map((u: any) => u.firstName).sort()).toEqual(['Alice', 'Bob']);

      const inactive = await http().get('/users').query({ where: JSON.stringify({ isActive: { $isFalse: true } }) }).expect(200);
      expect(inactive.body.items.map((u: any) => u.firstName)).toEqual(['Carol']);
    });
  });

  describe('update + soft-delete + restore', () => {
    it('updates a single record', async () => {
      const { alice } = await seed();
      const res = await http().put(`/users/${alice.id}`).send({ firstName: 'Alicia' }).expect(200);
      expect(res.body.firstName).toBe('Alicia');
    });

    it('soft-delete sets deletedAt, hides by default, and restores', async () => {
      const { bob } = await seed();

      await http().delete(`/users/${bob.id}`).expect(200);
      expect((await http().get('/users').expect(200)).body.total).toBe(2);

      const trash = await http().get('/users').query({ onlyDeleted: 'true' }).expect(200);
      expect(trash.body.items.map((u: any) => u.firstName)).toEqual(['Bob']);
      expect(trash.body.items[0].deletedAt).toBeTruthy();

      expect((await http().get('/users').query({ withDeleted: 'true' }).expect(200)).body.total).toBe(3);

      await http().put(`/users/${bob.id}/restore`).expect(200);
      expect((await http().get('/users').expect(200)).body.total).toBe(3);
    });
  });

  describe('bulk update + bulk delete', () => {
    it('bulk-updates and bulk-deletes by id', async () => {
      const { alice, bob } = await seed();

      const upd = await http().put('/users/bulk').send({ bulk: [{ id: alice.id, role: 'editor' }, { id: bob.id, role: 'editor' }] }).expect(200);
      expect(upd.body.map((u: any) => u.role)).toEqual(['editor', 'editor']);

      await http().delete('/users/delete/bulk').query({ ids: [alice.id, bob.id] }).expect(200);
      expect((await http().get('/users').expect(200)).body.total).toBe(1); // only Carol left
    });
  });

  describe('reorder', () => {
    it('persists a new order via PUT /tasks/reorder', async () => {
      const created = await http().post('/tasks/bulk').send({
        bulk: [{ title: 'T1' }, { title: 'T2' }, { title: 'T3' }],
      }).expect(201);
      const [t1, t2, t3] = created.body;

      await http().put('/tasks/reorder').send({ ids: [t3.id, t1.id, t2.id] }).expect(200);

      const res = await http().get('/tasks').query({ order: JSON.stringify({ order: 'ASC' }) }).expect(200);
      expect(res.body.items.map((t: any) => t.title)).toEqual(['T3', 'T1', 'T2']);
      expect(res.body.items.map((t: any) => t.order)).toEqual([0, 1, 2]);
    });
  });

  // Needs a real second connection: the bulk methods save inside one transaction,
  // and a hook that uses `this.repository` runs on another connection.
  describe('bulk hooks and the transaction', () => {
    /** afterUpdate reads the row and writes back to it through the plain repository. */
    class AfterHookService extends CrudService<User> {
      seenAge: number[] = [];
      protected async afterUpdate(user: User) {
        const fresh = await this.repository.findOneByOrFail({ id: user.id });
        this.seenAge.push(fresh.age); // must be the committed, new value
        await this.repository.update(user.id, { lastName: 'touched' }); // must not hang
        return user;
      }
    }

    /** beforeSave reads through the transaction's manager. */
    class BeforeHookService extends CrudService<User> {
      countsInTx: number[] = [];
      protected async beforeSave(data: Partial<User>, _req?: any, ctx?: CrudSaveContext<User>) {
        if (ctx?.manager) this.countsInTx.push(await ctx.manager.count(User));
        return data;
      }
    }

    it('updateMany: after-hooks run after commit — they see the new values and can write the row', async () => {
      const { alice, bob } = await seed();
      const svc = new AfterHookService(ds.getRepository(User));
      await svc.updateMany({ bulk: [{ id: alice.id, age: 31 }, { id: bob.id, age: 26 }] as any });
      expect(svc.seenAge).toEqual([31, 26]);
      const rows = await ds.getRepository(User).findBy({ lastName: 'touched' });
      expect(rows).toHaveLength(2);
    }, 15000);

    it('createMany: before-hooks get the transaction manager and see rows saved earlier in it', async () => {
      await seed(); // 3 users committed
      const svc = new BeforeHookService(ds.getRepository(User));
      await svc.createMany({
        bulk: [{ email: 'd@e.com', firstName: 'D', lastName: 'D', password: 'h' }] as any,
      });
      expect(svc.countsInTx).toEqual([3]);
    });
  });

  // Postgres raises an error on a non-UUID value for a uuid column; the package must
  // treat such an id as "not found" instead of answering 500.
  describe('ids that are not UUIDs', () => {
    it('single-row routes answer 404, bulk routes skip them', async () => {
      const { alice } = await seed();
      await http().get('/users/abc').expect(404);
      await http().put('/users/abc').send({ firstName: 'X' }).expect(404);
      await http().delete('/users/abc').expect(404);

      const upd = await http()
        .put('/users/bulk')
        .send({ bulk: [{ id: 'abc', firstName: 'X' }, { id: alice.id, firstName: 'Alicia' }] })
        .expect(200);
      expect(upd.body.map((u: any) => u.id)).toEqual([alice.id]);

      await http().delete('/users/delete/bulk').query({ ids: ['abc', alice.id] }).expect(200);
      await http().get(`/users/${alice.id}`).expect(404);
    });
  });

  describe('aggregate list sorted by a many-to-one column', () => {
    it('GET /posts with aggregates + order by author.firstName', async () => {
      await seed(); // Alice: 2 posts, Bob: 1 post
      const aggregates = JSON.stringify([{ fn: 'count', field: 'comments.id', as: 'commentCount' }]);
      const asc = await http().get('/posts').query({
        aggregates, relations: JSON.stringify(['author']), order: JSON.stringify({ 'author.firstName': 'ASC' }),
      }).expect(200);
      expect(asc.body.items.map((p: any) => p.author.firstName)).toEqual(['Alice', 'Alice', 'Bob']);
      const desc = await http().get('/posts').query({
        aggregates, relations: JSON.stringify(['author']), order: JSON.stringify({ 'author.firstName': 'DESC' }),
      }).expect(200);
      expect(desc.body.items.map((p: any) => p.author.firstName)).toEqual(['Bob', 'Alice', 'Alice']);
    });
  });

  describe('counts with sum, and soft-deleted related rows', () => {
    it('GET /posts/get/counts?groupByKey=status&sum=likes', async () => {
      await seed(); // published 10 + 20, draft 5
      const res = await http().get('/posts/get/counts').query({ groupByKey: 'status', sum: 'likes' }).expect(200);
      const byStatus = Object.fromEntries(res.body.data.map((r: any) => [r.status, r]));
      expect(byStatus.published).toEqual({ status: 'published', count: 2, likes: 30 });
      expect(byStatus.draft).toEqual({ status: 'draft', count: 1, likes: 5 });
      expect(res.body.sum).toEqual({ likes: 35 });
      await http().get('/posts/get/counts').query({ sum: 'title' }).expect(400);
    });

    it('$exists ignores a soft-deleted related row', async () => {
      const { bob } = await seed(); // Bob has one post
      const bobPost = (await http().get('/posts').query({ where: JSON.stringify({ authorId: bob.id }) })).body.items[0];
      await http().delete(`/posts/${bobPost.id}`).expect(200); // soft delete
      const res = await http().get('/users').query({ where: JSON.stringify({ posts: { $exists: true } }) }).expect(200);
      expect(res.body.items.map((u: any) => u.firstName)).toEqual(['Alice']);
    });
  });
});
