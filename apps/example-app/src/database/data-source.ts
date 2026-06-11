import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { User } from './entities/user.entity';
import { Post } from './entities/post.entity';
import { Profile } from './entities/profile.entity';
import { Address } from './entities/address.entity';
import { Comment } from './entities/comment.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Task } from './entities/task.entity';

// Load apps/example-app/.env once, for both `pnpm start` and the e2e tests, so the
// Postgres credentials are set in a file instead of typed on every run. dotenv does
// not override variables already in the environment, so inline env still wins.
loadEnv({ path: join(__dirname, '..', '..', '.env') });

export const entities = [User, Post, Profile, Address, Comment, AuditLog, Task];

/**
 * TypeORM connection options for the example app — real Postgres, configured from
 * `.env` (or individual `DB_*` / `PG*` vars, or a single `DATABASE_URL`).
 */
export function typeOrmOptions(): TypeOrmModuleOptions {
    return {
        type: 'postgres',
        url: process.env.DATABASE_URL,
        host: process.env.DB_HOST ?? process.env.PGHOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? process.env.PGPORT ?? 5432),
        username: process.env.DB_USER ?? process.env.PGUSER ?? 'postgres',
        password: process.env.DB_PASSWORD ?? process.env.PGPASSWORD ?? 'postgres',
        database: process.env.DB_NAME ?? process.env.PGDATABASE ?? 'nest_crud_example',
        entities,
        synchronize: true,
        logging: false,
    };
}
