# Example App - @ackplus/nest-crud

Complete working example demonstrating nest-crud with TypeORM and SQLite using the **CLI approach**.

## 🚀 Quick Start

### 1. Build the Package

```bash
# From root directory
pnpm -C packages/nest-crud build
```

### 2. Run Tests

```bash
pnpm test
```

### 3. Seed Database

```bash
# Basic seed (10 users, 30 posts)
pnpm seed

# Drop and reseed
pnpm seed:refresh

# Run specific seeder
pnpm seed:users

# Watch mode (auto-reseed on changes)
pnpm seed:watch
```

### 4. Start Application

```bash
pnpm start:dev
```

## 📁 Project Structure

```
example-app/
├── src/
│   ├── database/
│   │   ├── entities/       # TypeORM entities
│   │   ├── factories/      # Data factories
│   │   └── seeders/        # Seeders
│   ├── app.module.ts       # Main module (no seeder imports!)
│   └── main.ts            # App entry
├── seeder.config.ts       # Seeder CLI configuration
└── test/                  # Tests
```

## 🎯 Features Demonstrated

- ✅ **CLI-based seeding** (no app.module.ts modifications)
- ✅ TypeORM with SQLite
- ✅ Entity relationships (One-to-Many)
- ✅ Factory pattern with Faker.js
- ✅ Batch insertion
- ✅ Watch mode with auto-reload
- ✅ 40+ tests with 90%+ coverage

## 📊 What's Included

### Configuration

**seeder.config.ts** - CLI configuration file:
```typescript
export default {
  imports: [
    TypeOrmModule.forRoot({ /* db config */ }),
    TypeOrmModule.forFeature([User, Post]),
  ],
  seeders: [UserSeeder, PostSeeder],
};
```

### Entities
- **User** - email, name, role, posts relationship
- **Post** - title, content, status, author relationship

### Factories
- **UserFactory** - Generates realistic user data
- **PostFactory** - Generates realistic post data

### Seeders
- **UserSeeder** - Seeds users with batch insertion
- **PostSeeder** - Seeds posts with relationships

### Tests
- Factory tests (21 tests)
- Seeder integration tests (17 tests)
- E2E tests (8 tests)

## 💡 Examples

### Entity

```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];
}
```

### Factory

```typescript
export class UserFactory {
  @Factory((faker) => faker.internet.email())
  email: string;

  @Factory((faker) => faker.person.firstName())
  firstName: string;
}
```

### Seeder

```typescript
@Injectable()
export class UserSeeder implements Seeder {
  async seed(options: SeederServiceOptions): Promise<void> {
    const factory = DataFactory.createForClass(UserFactory);
    const users = factory.generate(10);
    await this.userRepository.save(users);
  }

  async drop(options: SeederServiceOptions): Promise<void> {
    await this.userRepository.delete({});
  }
}
```

## 🛠️ Development

### Available Commands

```bash
# Seeding
pnpm seed              # Run all seeders
pnpm seed:refresh      # Drop and reseed all
pnpm seed:users        # Run only UserSeeder
pnpm seed:watch        # Auto-reseed on file changes

# Development
pnpm start:dev         # Start app in watch mode
pnpm test:watch        # Run tests in watch mode

# Testing
pnpm test              # Run all tests
pnpm test:cov          # Run with coverage
pnpm test:e2e          # Run E2E tests
```

### Watch Modes

Run multiple terminals for full development workflow:

```bash
# Terminal 1: Application server
pnpm start:dev

# Terminal 2: Tests with auto-reload
pnpm test:watch

# Terminal 3: Auto-reseed on changes
pnpm seed:watch
```

### Adding New Entity

1. Create entity in `src/database/entities/`
2. Create factory in `src/database/factories/`
3. Create seeder in `src/database/seeders/`
4. **Update `seeder.config.ts`** (not app.module.ts!)
5. Run `pnpm seed`

## 🐛 Troubleshooting

**Database locked error:**
```bash
rm database.sqlite
pnpm seed
```

**Import errors:**
```bash
pnpm -C packages/nest-crud build
```

**Test failures:**
```bash
pnpm test --clearCache
pnpm test
```

## 📚 Learn More

- [Main Documentation](../../packages/nest-crud/README.md)
- [Quick Start Guide](../../packages/nest-crud/QUICKSTART.md)
- [More Examples](../../packages/nest-crud/examples/)

---

**Questions?** Check the [main README](../../README.md) or open an issue!
