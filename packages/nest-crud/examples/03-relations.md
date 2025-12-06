# Example 3: Relations

This example demonstrates how to work with entity relations in `@ackplus/nest-crud`.

## Entities with Relations

### User Entity (One-to-Many)

```typescript
// user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { Post } from './post.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];

  @CreateDateColumn()
  createdAt: Date;
}
```

### Post Entity (Many-to-One)

```typescript
// post.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column('text')
  content: string;

  @Column({ default: 'draft' })
  status: string;

  @Column()
  authorId: number;

  @ManyToOne(() => User, (user) => user.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ default: true })
  published: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
```

## Loading Relations

### Simple Relations

```bash
# Load user with posts
GET /users/1?relations=["posts"]

# Load post with author
GET /posts/1?relations=["author"]

# Load all users with their posts
GET /users?relations=["posts"]
```

### Multiple Relations

```bash
# Load multiple relations
GET /users?relations=["posts","profile","settings"]
```

### Nested Relations

For deeply nested relations, you need to use the object syntax:

```bash
# Load user with posts and post comments
GET /users?relations={"posts":{"select":["id","title"]}}
```

### Relations with Field Selection

```bash
# Load posts with only specific fields
GET /users?relations={"posts":{"select":["id","title","createdAt"]}}

# Load author with only name fields
GET /posts?relations={"author":{"select":["id","firstName","lastName"]}}
```

### Relations with Filtering

```bash
# Load only published posts
GET /users?relations={"posts":{"where":{"published":{"$eq":true}}}}

# Load posts with specific status
GET /users?relations={"posts":{"where":{"status":{"$eq":"published"}}}}

# Complex relation filtering
GET /users?relations={"posts":{"where":{"$and":[{"published":{"$eq":true}},{"status":{"$eq":"published"}}]}}}
```

### Relations with Join Type

```bash
# Inner join (only users with posts)
GET /users?relations={"posts":{"joinType":"inner"}}

# Left join (all users, including those without posts) - default
GET /users?relations={"posts":{"joinType":"left"}}
```

## Controller with Relations

```typescript
// user.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { Crud } from '@ackplus/nest-crud';
import { User } from './user.entity';
import { UserService } from './user.service';

@Crud({
  entity: User,
  routes: {
    findAll: true,
    findOne: true,
    create: true,
    update: true,
    delete: true,
  },
})
@Controller('users')
export class UserController {
  constructor(public service: UserService) {}

  @Get(':id/posts')
  async getUserPosts(@Param('id') id: number) {
    const user = await this.service.findOne({
      where: { id },
      relations: ['posts'],
    });
    return user.posts;
  }

  @Get(':id/published-posts')
  async getUserPublishedPosts(@Param('id') id: number) {
    return this.service.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.posts', 'post')
      .where('user.id = :id', { id })
      .andWhere('post.published = :published', { published: true })
      .getOne();
  }

  @Get(':id/with-relations')
  async getUserWithRelations(@Param('id') id: number) {
    return this.service.findOne({
      where: { id },
      relations: ['posts', 'profile', 'settings'],
    });
  }
}
```

```typescript
// post.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { Crud } from '@ackplus/nest-crud';
import { Post } from './post.entity';
import { PostService } from './post.service';

@Crud({
  entity: Post,
  routes: {
    findAll: true,
    findOne: true,
    create: true,
    update: true,
    delete: true,
  },
})
@Controller('posts')
export class PostController {
  constructor(public service: PostService) {}

  @Get('published')
  async getPublishedPosts() {
    return this.service.find({
      where: { published: true },
      relations: ['author'],
    });
  }

  @Get('by-author/:authorId')
  async getPostsByAuthor(@Param('authorId') authorId: number) {
    return this.service.find({
      where: { authorId },
      relations: ['author'],
    });
  }
}
```

## Service with Relations

```typescript
// user.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '@ackplus/nest-crud';
import { User } from './user.entity';

@Injectable()
export class UserService extends CrudService<User> {
  constructor(
    @InjectRepository(User)
    protected repository: Repository<User>,
  ) {
    super(repository);
  }

  async findWithPosts(id: number): Promise<User | null> {
    return this.findOne({
      where: { id },
      relations: ['posts'],
    });
  }

  async findWithPublishedPosts(id: number): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.posts', 'post', 'post.published = :published', {
        published: true,
      })
      .where('user.id = :id', { id })
      .getOne();
  }

  async findActiveUsersWithPosts(): Promise<User[]> {
    return this.find({
      where: { isActive: true },
      relations: ['posts'],
    });
  }
}
```

```typescript
// post.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '@ackplus/nest-crud';
import { Post } from './post.entity';

@Injectable()
export class PostService extends CrudService<Post> {
  constructor(
    @InjectRepository(Post)
    protected repository: Repository<Post>,
  ) {
    super(repository);
  }

  async findPublishedWithAuthor(): Promise<Post[]> {
    return this.find({
      where: { published: true },
      relations: ['author'],
    });
  }

  async findByAuthor(authorId: number): Promise<Post[]> {
    return this.find({
      where: { authorId },
      relations: ['author'],
    });
  }

  async findWithAuthorDetails(id: number): Promise<Post | null> {
    return this.repository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.id = :id', { id })
      .getOne();
  }
}
```

## Module Configuration

```typescript
// user.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './user.entity';
import { Post } from './post.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Post])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

```typescript
// post.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { Post } from './post.entity';
import { User } from './user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Post, User])],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}
```

## Testing with curl

```bash
# Get user with posts
curl http://localhost:3000/users/1?relations=["posts"]

# Get post with author
curl http://localhost:3000/posts/1?relations=["author"]

# Get user with posts (only specific fields)
curl -G http://localhost:3000/users/1 \
  --data-urlencode 'relations={"posts":{"select":["id","title"]}}'

# Get user with published posts
curl -G http://localhost:3000/users/1 \
  --data-urlencode 'relations={"posts":{"where":{"published":{"$eq":true}}}}'

# Get all published posts with authors
curl -G http://localhost:3000/posts \
  --data-urlencode 'where={"published":{"$eq":true}}' \
  --data-urlencode 'relations=["author"]'

# Custom endpoints
curl http://localhost:3000/users/1/posts
curl http://localhost:3000/users/1/published-posts
curl http://localhost:3000/posts/published
curl http://localhost:3000/posts/by-author/1
```

## Advanced Relation Patterns

### Counting Related Records

```typescript
@Get(':id/post-count')
async getUserPostCount(@Param('id') id: number) {
  const result = await this.service.repository
    .createQueryBuilder('user')
    .leftJoin('user.posts', 'post')
    .where('user.id = :id', { id })
    .select('user.*')
    .addSelect('COUNT(post.id)', 'postCount')
    .groupBy('user.id')
    .getRawOne();
  
  return result;
}
```

### Aggregations on Relations

```typescript
@Get(':id/post-stats')
async getUserPostStats(@Param('id') id: number) {
  const stats = await this.service.repository
    .createQueryBuilder('user')
    .leftJoin('user.posts', 'post')
    .where('user.id = :id', { id })
    .select([
      'COUNT(post.id) as totalPosts',
      'COUNT(CASE WHEN post.published = true THEN 1 END) as publishedPosts',
      'COUNT(CASE WHEN post.status = \'draft\' THEN 1 END) as draftPosts',
    ])
    .getRawOne();
  
  return stats;
}
```

## Best Practices

1. **Limit Relations**: Only load relations you actually need
2. **Use Select**: Specify which fields to load from relations
3. **Index Foreign Keys**: Always index foreign key columns
4. **Eager Loading**: Use `eager: true` in entity definition for always-needed relations
5. **Lazy Loading**: Use lazy loading for rarely-accessed relations
6. **Circular Dependencies**: Be careful with circular references
7. **Performance**: Monitor N+1 query problems with query logging

## Next Steps

- [Custom Actions](./04-custom-actions.md) - Add custom endpoints
- [Pagination](./08-pagination.md) - Paginate results with relations
- [Complete Example](./10-complete-example.md) - See it all together

