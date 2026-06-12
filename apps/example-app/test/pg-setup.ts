import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Importing data-source loads apps/example-app/.env and exposes the shared
// Postgres options used by both the demo app and these e2e tests.
import { typeOrmOptions } from '../src/database/data-source';
import { UserModule } from '../src/users/user.module';
import { PostModule } from '../src/posts/post.module';
import { ProfileModule } from '../src/profiles/profile.module';
import { CommentModule } from '../src/comments/comment.module';
import { TaskModule } from '../src/tasks/task.module';

/**
 * Shared bootstrap for the real-Postgres e2e suites. Opt-in: only runs when a
 * Postgres target is configured (via `.env` or env vars), else `describe.skip`, so
 * it never breaks CI without a database.
 */
export const hasPgTarget = !!(
  process.env.DATABASE_URL ||
  process.env.DB_HOST ||
  process.env.PGHOST ||
  process.env.RUN_PG_E2E
);
export const describePg = hasPgTarget ? describe : describe.skip;

export async function bootstrapPgApp(): Promise<{ app: INestApplication; ds: DataSource }> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      // dropSchema gives each e2e run a clean schema (so leftover tables/data can't
      // break it); truncateAll() clears data before each test. Test-only — the demo
      // app keeps its data. Point the e2e at a database you're happy to reset.
      TypeOrmModule.forRoot({ ...typeOrmOptions(), dropSchema: true }),
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
