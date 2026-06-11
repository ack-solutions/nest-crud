import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { User } from '../src/database/entities/user.entity';
import { Post } from '../src/database/entities/post.entity';
import { Profile } from '../src/database/entities/profile.entity';
import { Address } from '../src/database/entities/address.entity';
import { Comment } from '../src/database/entities/comment.entity';
import { AuditLog } from '../src/database/entities/audit-log.entity';
import { Task } from '../src/database/entities/task.entity';
import { UserModule } from '../src/users/user.module';
import { PostModule } from '../src/posts/post.module';
import { ProfileModule } from '../src/profiles/profile.module';
import { CommentModule } from '../src/comments/comment.module';
import { TaskModule } from '../src/tasks/task.module';

/**
 * Shared bootstrap for the real-Postgres e2e suites. Opt-in: only runs when a
 * Postgres target is configured via env (else the suites use `describe.skip`), so
 * it never breaks machines / CI without a database. Configure with individual
 * `DB_*` / `PG*` vars or a single `DATABASE_URL`.
 */
export const hasPgTarget = !!(
  process.env.DATABASE_URL ||
  process.env.DB_HOST ||
  process.env.PGHOST ||
  process.env.RUN_PG_E2E
);
export const describePg = hasPgTarget ? describe : describe.skip;

const entities = [User, Post, Profile, Address, Comment, AuditLog, Task];

export function typeOrmConfig() {
  return {
    type: 'postgres' as const,
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST ?? process.env.PGHOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? process.env.PGPORT ?? 5432),
    username: process.env.DB_USER ?? process.env.PGUSER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? process.env.PGPASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? process.env.PGDATABASE ?? 'nest_crud_e2e',
    entities,
    synchronize: true,
    logging: false,
  };
}

export async function bootstrapPgApp(): Promise<{ app: INestApplication; ds: DataSource }> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot(typeOrmConfig()),
      UserModule,
      PostModule,
      ProfileModule,
      CommentModule,
      TaskModule,
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe());
  await app.init();
  return { app, ds: app.get(DataSource) };
}

/** TRUNCATE only our tables (CASCADE handles FK order) — never touches other schemas. */
export async function truncateAll(ds: DataSource): Promise<void> {
  await ds.query('TRUNCATE TABLE users, posts, comments, profiles, addresses, audit_logs, tasks RESTART IDENTITY CASCADE');
}
