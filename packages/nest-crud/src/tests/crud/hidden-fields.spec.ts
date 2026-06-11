import { Column, DataSource, Entity, ManyToOne, OneToMany, Repository } from 'typeorm';

import { BaseEntity } from '../../lib/base-entity';
import { CrudService } from '../../lib/service/crud-service';
import { CrudHidden, addHiddenField, getHiddenFields } from '../../lib/decorator/crud-hidden.decorator';

/**
 * Security — `@CrudHidden()` / `@Crud({ hiddenFields })` make a column or relation
 * invisible to all CRUD queries: dropped from responses, and unusable in `where`,
 * `order`, `aggregates`, or `relations` (rejected like an unknown field, so the
 * field's existence is not revealed). Self-contained entities + DataSource so the
 * global hidden metadata never leaks into the shared `User` fixtures.
 */
// SecureUser is declared first: its `@OneToMany ...[]` relations emit `Array` as
// design:type (no eager class reference), while the `@ManyToOne` sides below emit
// SecureUser — which must already exist to avoid a temporal-dead-zone error.
@Entity('secure_users')
class SecureUser extends BaseEntity {
    @Column() name: string;
    @Column({ nullable: true }) @CrudHidden() passwordHash: string;     // hidden column
    @OneToMany(() => SecurePost, (p) => p.user, { cascade: true }) posts: SecurePost[];
    @OneToMany(() => SecretLog, (l) => l.user, { cascade: true }) @CrudHidden() secretLogs: SecretLog[]; // hidden relation
}

@Entity('secure_posts')
class SecurePost extends BaseEntity {
    @Column() title: string;
    @Column({ nullable: true }) @CrudHidden() draftNotes: string; // hidden nested column
    @ManyToOne(() => SecureUser, (u) => u.posts) user: SecureUser;
}

@Entity('secret_logs')
class SecretLog extends BaseEntity {
    @Column() action: string;
    @ManyToOne(() => SecureUser, (u) => u.secretLogs) user: SecureUser;
}

describe('Hidden / sensitive field guard', () => {
    let dataSource: DataSource;
    let repo: Repository<SecureUser>;
    let service: CrudService<any>;

    beforeAll(async () => {
        dataSource = new DataSource({
            type: 'sqljs',
            autoSave: false,
            entities: [SecureUser, SecurePost, SecretLog],
            synchronize: true,
            logging: false,
        } as any);
        await dataSource.initialize();
        repo = dataSource.getRepository(SecureUser);
        service = new CrudService(repo as any);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        await repo.save(repo.create({
            name: 'Alice',
            passwordHash: 'super-secret-hash',
            posts: [
                { title: 'Hello', draftNotes: 'unpublished thoughts' } as SecurePost,
                { title: 'World', draftNotes: 'more secrets' } as SecurePost,
            ],
            secretLogs: [{ action: 'login' } as SecretLog],
        }));
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    describe('metadata', () => {
        it('collects fields declared with @CrudHidden()', () => {
            const hidden = getHiddenFields(SecureUser);
            expect(hidden.has('passwordHash')).toBe(true);
            expect(hidden.has('secretLogs')).toBe(true);
            expect(hidden.has('name')).toBe(false);
        });

        it('@Crud({ hiddenFields }) routes through the same store (addHiddenField)', () => {
            // Use a throwaway class so SecureUser's hidden set is not mutated.
            class Dummy {}
            addHiddenField(Dummy, 'apiKey');
            expect(getHiddenFields(Dummy).has('apiKey')).toBe(true);
        });
    });

    describe('responses', () => {
        it('omits a hidden column from the default projection', async () => {
            const { items } = await service.findMany({});
            expect(items[0].name).toBe('Alice');
            expect(items[0].passwordHash).toBeUndefined();
        });

        it('drops a hidden column from an explicit select (keeps id + visible fields)', async () => {
            const { items } = await service.findMany({ select: JSON.stringify(['name', 'passwordHash']) } as any);
            expect(items[0].id).toBeDefined();
            expect(items[0].name).toBe('Alice');
            expect(items[0].passwordHash).toBeUndefined();
        });

        it('hydrates a visible relation but omits its hidden column', async () => {
            const { items } = await service.findMany({ relations: JSON.stringify(['posts']) } as any);
            expect(items[0].posts).toHaveLength(2);
            expect(items[0].posts[0].title).toBeDefined();
            expect(items[0].posts[0].draftNotes).toBeUndefined();
        });
    });

    describe('rejections (treated like unknown fields → 400)', () => {
        it('rejects filtering on a hidden column', async () => {
            await expect(
                service.findMany({ where: JSON.stringify({ passwordHash: { $eq: 'x' } }) } as any),
            ).rejects.toThrow();
        });

        it('rejects ordering by a hidden column', async () => {
            await expect(
                service.findMany({ order: JSON.stringify({ passwordHash: 'ASC' }) } as any),
            ).rejects.toThrow();
        });

        it('rejects joining a hidden relation', async () => {
            await expect(
                service.findMany({ relations: JSON.stringify(['secretLogs']) } as any),
            ).rejects.toThrow();
        });

        it('rejects an aggregate over a hidden relation or hidden column', async () => {
            await expect(
                service.findMany({ aggregates: JSON.stringify([{ fn: 'count', field: 'secretLogs.id', as: 'n' }]) } as any),
            ).rejects.toThrow();
            await expect(
                service.findMany({ aggregates: JSON.stringify([{ fn: 'count', field: 'posts.draftNotes', as: 'n' }]) } as any),
            ).rejects.toThrow();
        });

        it('still allows aggregates / filters on visible fields', async () => {
            const { items } = await service.findMany({
                aggregates: JSON.stringify([{ fn: 'count', field: 'posts.id', as: 'postCount' }]),
            } as any);
            expect((items[0] as any).postCount).toBe(2);
        });
    });
});
