import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './database/entities/user.entity';
import { Post } from './database/entities/post.entity';
import { UserSeeder } from './database/seeders/user.seeder';
import { PostSeeder } from './database/seeders/post.seeder';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'database.sqlite',
      entities: [User, Post],
      synchronize: true,
      logging: false,
    }),
    TypeOrmModule.forFeature([User, Post]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
