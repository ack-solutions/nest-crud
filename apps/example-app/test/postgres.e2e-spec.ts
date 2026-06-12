import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';

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
});
