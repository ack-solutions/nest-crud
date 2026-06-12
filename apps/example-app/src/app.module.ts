import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { typeOrmOptions } from './database/data-source';
import { SeedService } from './database/seed.service';
import { UserModule } from './users/user.module';
import { PostModule } from './posts/post.module';
import { ProfileModule } from './profiles/profile.module';
import { CommentModule } from './comments/comment.module';
import { TaskModule } from './tasks/task.module';

@Module({
  imports: [
    // Real Postgres, configured from .env (see .env.example / data-source.ts).
    TypeOrmModule.forRootAsync({ useFactory: typeOrmOptions }),
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
