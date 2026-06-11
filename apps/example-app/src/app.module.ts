import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './database/entities/user.entity';
import { Post } from './database/entities/post.entity';
import { Profile } from './database/entities/profile.entity';
import { Address } from './database/entities/address.entity';
import { Comment } from './database/entities/comment.entity';
import { AuditLog } from './database/entities/audit-log.entity';
import { Task } from './database/entities/task.entity';
import { SeedService } from './database/seed.service';
import { UserModule } from './users/user.module';
import { PostModule } from './posts/post.module';
import { ProfileModule } from './profiles/profile.module';
import { CommentModule } from './comments/comment.module';
import { TaskModule } from './tasks/task.module';

const entities = [User, Post, Profile, Address, Comment, AuditLog, Task];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      // Defaults to an in-memory database so the demo starts clean with zero setup.
      // Set DATABASE_PATH to a file (e.g. database.sqlite) to persist between runs.
      useFactory: () => ({
        type: 'sqljs',
        location: process.env.DATABASE_PATH,
        autoSave: !!process.env.DATABASE_PATH,
        entities,
        synchronize: true,
        logging: false,
      }),
    }),
    UserModule,
    PostModule,
    ProfileModule,
    CommentModule,
    TaskModule,
  ],
  controllers: [AppController],
  providers: [AppService, SeedService],
})
export class AppModule {}
