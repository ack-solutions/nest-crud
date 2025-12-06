# Example 1: Basic CRUD

This example shows the simplest setup for a CRUD controller with `@ackplus/nest-crud`.

## Entity

```typescript
// user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

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

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

## Service

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
}
```

## Controller

```typescript
// user.controller.ts
import { Controller } from '@nestjs/common';
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
}
```

## Module

```typescript
// user.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

## API Endpoints

This setup automatically generates the following endpoints:

### GET /users
Get all users with optional filtering, pagination, and relations.

**Examples:**
```bash
# Get all users
GET /users

# Get active users
GET /users?where={"isActive":{"$eq":true}}

# Get users with pagination
GET /users?skip=0&take=10

# Get specific fields
GET /users?select=["id","email","firstName"]

# Sort by creation date
GET /users?order={"createdAt":"DESC"}
```

### GET /users/:id
Get a single user by ID.

**Examples:**
```bash
GET /users/1
```

### POST /users
Create a new user.

**Request body:**
```json
{
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

### PATCH /users/:id
Update a user by ID.

**Request body:**
```json
{
  "firstName": "Jane"
}
```

### DELETE /users/:id
Delete a user by ID.

**Examples:**
```bash
DELETE /users/1
```

## Testing with curl

```bash
# Create a user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Get all users
curl http://localhost:3000/users

# Get a specific user
curl http://localhost:3000/users/1

# Update a user
curl -X PATCH http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Jane"}'

# Delete a user
curl -X DELETE http://localhost:3000/users/1
```

## Next Steps

- [Advanced Filtering](./02-advanced-filtering.md) - Learn about complex queries
- [Relations](./03-relations.md) - Work with related entities
- [Validation](./05-validation.md) - Add request validation

