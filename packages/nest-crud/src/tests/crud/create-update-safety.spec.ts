import { BadRequestException, INestApplication } from '@nestjs/common';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import request from 'supertest';

import { createCrudTestApp } from '../helper/testing-module';
import { User } from '../helper/entities/user-test.entity';
import { Post } from '../helper/entities/post-test.entity';
import { Profile } from '../helper/entities/profile-test.entity';
import { Comment } from '../helper/entities/comment-test.entity';
import { OrderedItem } from '../helper/entities/ordered-item-test.entity';
import { CrudService } from '../../lib/service/crud-service';
import { CrudActionsEnum, CrudSaveContext } from '../../lib/interface/crud';
import { stripServerManagedFields } from '../../index';

/** Records what beforeSave receives. */
class SpyUserService extends CrudService<User> {
    calls: Array<{ entity: any; context?: CrudSaveContext<User> }> = [];
    protected async beforeSave(entity: Partial<User>, _request?: any, context?: CrudSaveContext<User>) {
        this.calls.push({ entity: { ...entity }, context });
        return entity;
    }
}

/** Opts out of the create sanitizing (client-generated ids). */
class ClientIdUserService extends CrudService<User> {
    protected prepareCreateData(data: Partial<User>) {
        return data;
    }
}

/** Scopes every mutation (reorder included) to rows named 'mine'. */
class ScopedItemService extends CrudService<OrderedItem> {
    protected async beforeMutate(criteria: FindOptionsWhere<OrderedItem>) {
        return { ...criteria, name: 'mine' } as FindOptionsWhere<OrderedItem>;
    }
}

describe('create always inserts; update hooks know their row; reorder is scoped', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let users: Repository<User>;
    let posts: Repository<Post>;
    let profiles: Repository<Profile>;
    let comments: Repository<Comment>;
    let items: Repository<OrderedItem>;
    let a: User;
    let b: User;

    beforeAll(async () => {
        app = await createCrudTestApp({ entity: User, path: 'users' });
        dataSource = app.get(DataSource);
        users = dataSource.getRepository(User);
        posts = dataSource.getRepository(Post);
        profiles = dataSource.getRepository(Profile);
        comments = dataSource.getRepository(Comment);
        items = dataSource.getRepository(OrderedItem);
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        a = await users.save(users.create({ name: 'A', status: 'orgA' }));
        b = await users.save(users.create({ name: 'B', status: 'orgB' }));
    });

    describe('create', () => {
        it('a body id naming an existing row inserts a new row and leaves that row untouched', async () => {
            const created = await new CrudService<User>(users).create({ id: a.id, name: 'HACKED' } as any);
            expect(created.id).not.toBe(a.id);
            expect(created.name).toBe('HACKED');
            expect((await users.findOneBy({ id: a.id }))!.name).toBe('A');
            expect(await users.count()).toBe(3);
        });

        it('createMany with an existing id inserts and leaves that row untouched', async () => {
            const [created] = await new CrudService<User>(users).createMany({ bulk: [{ id: a.id, name: 'X' } as any] });
            expect(created.id).not.toBe(a.id);
            expect((await users.findOneBy({ id: a.id }))!.name).toBe('A');
        });

        it('one-to-many child rows sent with ids are inserted as new children; existing ones untouched', async () => {
            const post = await posts.save(posts.create({ title: 'orig', user: a }));
            const created = await new CrudService<User>(users).create({
                name: 'N',
                posts: [{ id: post.id, title: 'stolen' }],
            } as any);

            const original = await posts.findOne({ where: { id: post.id }, relations: ['user'] });
            expect(original!.title).toBe('orig');
            expect(original!.user.id).toBe(a.id); // not re-parented
            const theirs = await posts.find({ where: { user: { id: created.id } } });
            expect(theirs).toHaveLength(1);
            expect(theirs[0].id).not.toBe(post.id);
            expect(theirs[0].title).toBe('stolen');
        });

        it('the rule applies recursively (a grandchild sent with an id is not taken over)', async () => {
            const post = await posts.save(posts.create({ title: 'p', user: a }));
            const comment = await comments.save(comments.create({ content: 'orig', post }));
            await new CrudService<User>(users).create({
                name: 'N',
                posts: [{ title: 't', comments: [{ id: comment.id, content: 'stolen' }] }],
            } as any);

            const original = await comments.findOne({ where: { id: comment.id }, relations: ['post'] });
            expect(original!.content).toBe('orig');
            expect(original!.post.id).toBe(post.id);
        });

        it('an inverse one-to-one child sent with an id is not taken over', async () => {
            const profile = (await profiles.save(profiles.create({ user: a } as any))) as unknown as Profile;
            await new CrudService<User>(users).create({ name: 'N', profile: { id: profile.id } } as any);
            const original = await profiles.findOne({ where: { id: profile.id }, relations: ['user'] });
            expect(original!.user.id).toBe(a.id);
        });

        it('references keep their ids (a many-to-one object links to the existing row)', async () => {
            const created = await new CrudService<Post>(posts).create({ title: 'linked', user: { id: a.id } } as any);
            const reloaded = await posts.findOne({ where: { id: created.id }, relations: ['user'] });
            expect(reloaded!.user.id).toBe(a.id);
            expect(await users.count()).toBe(2); // no stray user created
        });

        it('create / delete date columns in the body are ignored', async () => {
            const created = await new CrudService<User>(users).create({
                name: 'N',
                createdAt: new Date('2000-01-01'),
                deletedAt: new Date('2000-01-01'),
            } as any);
            const row = await users.findOneBy({ id: created.id }); // live rows only
            expect(row).toBeTruthy();
            expect(row!.createdAt.getFullYear()).not.toBe(2000);
        });

        it('a body of only server-managed fields is rejected (nothing to insert)', async () => {
            await expect(new CrudService<User>(users).create({ id: a.id } as any)).rejects.toThrow(BadRequestException);
        });

        it('over HTTP: POST with an existing id creates a new row', async () => {
            const res = await request(app.getHttpServer()).post('/users').send({ id: a.id, name: 'HACKED' }).expect(201);
            expect(res.body.id).not.toBe(a.id);
            expect((await users.findOneBy({ id: a.id }))!.name).toBe('A');
        });

        it('beforeSave sees the sanitized body and a CREATE context', async () => {
            const svc = new SpyUserService(users);
            await svc.create({ id: a.id, name: 'N' } as any);
            expect(svc.calls[0].entity.id).toBeUndefined();
            expect(svc.calls[0].context).toEqual({ action: CrudActionsEnum.CREATE });
        });

        it('opt-out: overriding prepareCreateData keeps a client-supplied id', async () => {
            const id = '11111111-2222-4333-8444-555555555555';
            const created = await new ClientIdUserService(users).create({ id, name: 'client-id' } as any);
            expect(created.id).toBe(id);
        });

        it('stripServerManagedFields is exported for custom create paths', () => {
            const out: any = stripServerManagedFields(users.metadata, {
                id: 'x',
                name: 'n',
                createdAt: new Date(),
                posts: [{ id: 'p', title: 't', user: { id: 'u' } }],
            });
            expect(out).toEqual({ name: 'n', posts: [{ title: 't', user: { id: 'u' } }] });
        });
    });

    describe('update', () => {
        it('beforeSave sees the route id when the body has none, plus the stored row', async () => {
            const svc = new SpyUserService(users);
            await svc.update(a.id, { name: 'A2' });
            expect(svc.calls[0].entity.id).toBe(a.id);
            expect(svc.calls[0].context?.action).toBe(CrudActionsEnum.UPDATE);
            expect(svc.calls[0].context?.oldData?.name).toBe('A'); // stored row, before the change
        });

        it('beforeSave sees the route id even when the body names another row; that row is untouched', async () => {
            const svc = new SpyUserService(users);
            const updated = await svc.update(a.id, { id: b.id, name: 'A2' } as any);
            expect(svc.calls[0].entity.id).toBe(a.id);
            expect(updated.id).toBe(a.id);
            expect((await users.findOneBy({ id: b.id }))!.name).toBe('B');
        });

        it('a deletedAt in the update body does not soft-delete the row', async () => {
            await new CrudService<User>(users).update(a.id, { name: 'A2', deletedAt: new Date() } as any);
            const row = await users.findOneBy({ id: a.id });
            expect(row).toBeTruthy();
            expect(row!.name).toBe('A2');
        });

        it('updateMany: beforeSave gets the stored id and oldData per item', async () => {
            const svc = new SpyUserService(users);
            await svc.updateMany({ bulk: [{ id: a.id, name: 'A2' }, { id: b.id, name: 'B2' }] as any });
            expect(svc.calls.map((c) => c.entity.id)).toEqual([a.id, b.id]);
            expect(svc.calls.map((c) => c.context?.oldData?.name)).toEqual(['A', 'B']);
            expect(svc.calls.every((c) => c.context?.action === CrudActionsEnum.UPDATE_MANY)).toBe(true);
        });
    });

    describe('reorder', () => {
        it('each write goes through beforeMutate: ids outside the scope are not written', async () => {
            const [mine1, mine2, theirs] = await items.save(items.create([
                { name: 'mine', order: 88 },
                { name: 'mine', order: 88 },
                { name: 'theirs', order: 88 },
            ]));
            await new ScopedItemService(items).reorder([theirs.id, mine1.id, mine2.id]);
            const byId = new Map((await items.find()).map((r) => [r.id, r]));
            expect(byId.get(theirs.id)!.order).toBe(88); // out of scope → untouched
            expect(byId.get(mine1.id)!.order).toBe(1);
            expect(byId.get(mine2.id)!.order).toBe(2);
        });
    });
});
