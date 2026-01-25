# Example 2: Advanced Filtering

This example demonstrates how to use complex filtering with various operators.

## Available Operators

```typescript
import { WhereOperatorEnum } from '@ackplus/nest-crud';

// Comparison operators
WhereOperatorEnum.EQ          // Equal
WhereOperatorEnum.NOT_EQ      // Not equal
WhereOperatorEnum.GT          // Greater than
WhereOperatorEnum.GT_OR_EQ    // Greater than or equal
WhereOperatorEnum.LT          // Less than
WhereOperatorEnum.LT_OR_EQ    // Less than or equal

// Array operators
WhereOperatorEnum.IN          // In array
WhereOperatorEnum.NOT_IN      // Not in array


// String operators
WhereOperatorEnum.LIKE        // Like (case-sensitive)
WhereOperatorEnum.NOT_LIKE    // Not like
WhereOperatorEnum.ILIKE       // Like (case-insensitive)
WhereOperatorEnum.NOT_ILIKE   // Not like (case-insensitive)

// Null operators
WhereOperatorEnum.IS_NULL     // Is null
WhereOperatorEnum.IS_NOT_NULL // Is not null

// Range operators
WhereOperatorEnum.BETWEEN     // Between
WhereOperatorEnum.NOT_BETWEEN // Not between

// Boolean operators
WhereOperatorEnum.IS_TRUE     // Is true
WhereOperatorEnum.IS_FALSE    // Is false

// Logical operators
WhereLogicalOperatorEnum.AND  // Logical AND
WhereLogicalOperatorEnum.OR   // Logical OR
```

## Basic Filtering Examples

### Equality

```bash
# Find user with specific email
GET /users?where={"email":{"$eq":"john@example.com"}}

# Find inactive users
GET /users?where={"isActive":{"$eq":false}}
```

### Comparison

```bash
# Find users older than 18
GET /users?where={"age":{"$gt":18}}

# Find users 18 or older
GET /users?where={"age":{"$gte":18}}

# Find users younger than 65
GET /users?where={"age":{"$lt":65}}

# Find users 65 or younger
GET /users?where={"age":{"$lte":65}}
```

### IN / NOT IN

```bash
# Find admins and moderators
GET /users?where={"role":{"$in":["admin","moderator"]}}

# Find users except banned and suspended
GET /users?where={"role":{"$notIn":["banned","suspended"]}}
```

### String Matching

```bash
# Find users with Gmail (case-sensitive)
GET /users?where={"email":{"$like":"%@gmail.com"}}

# Find users with name containing "john" (case-insensitive)
GET /users?where={"firstName":{"$iLike":"%john%"}}

# Find users without "test" in email
GET /users?where={"email":{"$notLike":"%test%"}}
```

### Null Checks

```bash
# Find users without deletion date (active users)
GET /users?where={"deletedAt":{"$isNull":true}}

# Find users with deletion date (deleted users)
GET /users?where={"deletedAt":{"$isNotNull":true}}
```

### Range Queries

```bash
# Find users between 18 and 65 years old
GET /users?where={"age":{"$between":[18,65]}}

# Find users not between 0 and 17 years old
GET /users?where={"age":{"$notBetween":[0,17]}}
```

## Complex Filtering Examples

### Multiple Conditions (AND)

```bash
# Find active admin users
GET /users?where={"isActive":{"$eq":true},"role":{"$eq":"admin"}}

# Using $and explicitly
GET /users?where={"$and":[{"isActive":{"$eq":true}},{"role":{"$eq":"admin"}}]}
```

### Multiple Conditions (OR)

```bash
# Find admin or moderator users
GET /users?where={"$or":[{"role":{"$eq":"admin"}},{"role":{"$eq":"moderator"}}]}
```

### Nested Conditions

```bash
# Find active users who are either admin or moderator
GET /users?where={"isActive":{"$eq":true},"$or":[{"role":{"$eq":"admin"}},{"role":{"$eq":"moderator"}}]}

# Complex nested conditions
GET /users?where={"$and":[{"isActive":{"$eq":true}},{"$or":[{"role":{"$eq":"admin"}},{"role":{"$eq":"moderator"}}]},{"age":{"$gte":18}}]}
```

## Controller with Custom Filters

You can add custom endpoints with predefined filters:

```typescript
import { Controller, Get, Query } from '@nestjs/common';
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

  @Get('active')
  async getActiveUsers() {
    return this.service.find({
      where: { isActive: true },
    });
  }

  @Get('admins')
  async getAdmins() {
    return this.service.find({
      where: { role: 'admin' },
    });
  }

  @Get('search')
  async searchUsers(@Query('q') searchTerm: string) {
    return this.service.repository
      .createQueryBuilder('user')
      .where('user.email ILIKE :search', { search: `%${searchTerm}%` })
      .orWhere('user.firstName ILIKE :search', { search: `%${searchTerm}%` })
      .orWhere('user.lastName ILIKE :search', { search: `%${searchTerm}%` })
      .getMany();
  }

  @Get('age-range')
  async getUsersByAgeRange(
    @Query('min') minAge: number,
    @Query('max') maxAge: number,
  ) {
    return this.service.find({
      where: {
        age: {
          $gte: minAge,
          $lte: maxAge,
        },
      },
    });
  }
}
```

## Service with Custom Methods

```typescript
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

  async findActiveUsers(): Promise<User[]> {
    return this.find({
      where: { isActive: true },
    });
  }

  async findByRole(role: string): Promise<User[]> {
    return this.find({
      where: { role },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({
      where: { email },
    });
  }

  async searchUsers(searchTerm: string): Promise<User[]> {
    return this.repository
      .createQueryBuilder('user')
      .where('user.email ILIKE :search', { search: `%${searchTerm}%` })
      .orWhere('user.firstName ILIKE :search', { search: `%${searchTerm}%` })
      .orWhere('user.lastName ILIKE :search', { search: `%${searchTerm}%` })
      .getMany();
  }

  async findUsersByAgeRange(minAge: number, maxAge: number): Promise<User[]> {
    return this.repository
      .createQueryBuilder('user')
      .where('user.age >= :minAge', { minAge })
      .andWhere('user.age <= :maxAge', { maxAge })
      .getMany();
  }
}
```

## Testing with curl

```bash
# Find active admin users
curl -G http://localhost:3000/users \
  --data-urlencode 'where={"isActive":{"$eq":true},"role":{"$eq":"admin"}}'

# Find users with Gmail
curl -G http://localhost:3000/users \
  --data-urlencode 'where={"email":{"$like":"%@gmail.com"}}'

# Search users (case-insensitive)
curl -G http://localhost:3000/users \
  --data-urlencode 'where={"$or":[{"email":{"$iLike":"%john%"}},{"firstName":{"$iLike":"%john%"}},{"lastName":{"$iLike":"%john%"}}]}'

# Find users between 18 and 65
curl -G http://localhost:3000/users \
  --data-urlencode 'where={"age":{"$between":[18,65]}}'

# Custom endpoints
curl http://localhost:3000/users/active
curl http://localhost:3000/users/admins
curl "http://localhost:3000/users/search?q=john"
curl "http://localhost:3000/users/age-range?min=18&max=65"
```

## Tips

1. **URL Encoding**: Always URL-encode complex JSON queries
2. **Performance**: Add database indexes for frequently filtered fields
3. **Validation**: Validate filter values to prevent SQL injection
4. **Documentation**: Document your custom filter endpoints with Swagger

## Next Steps

- [Relations](./03-relations.md) - Filter by related entities
- [Pagination](./08-pagination.md) - Combine filtering with pagination
- [Service Customization](./09-service-customization.md) - Advanced service patterns

