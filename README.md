# @ackplus/nest-crud

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">A powerful and flexible database seeding library for NestJS applications</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@ackplus/nest-crud"><img src="https://img.shields.io/npm/v/@ackplus/nest-crud.svg" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/package/@ackplus/nest-crud"><img src="https://img.shields.io/npm/l/@ackplus/nest-crud.svg" alt="Package License" /></a>
  <a href="https://www.npmjs.com/package/@ackplus/nest-crud"><img src="https://img.shields.io/npm/dm/@ackplus/nest-crud.svg" alt="NPM Downloads" /></a>
</p>

## 📦 About

`@ackplus/nest-crud` is a CLI-based database seeding solution for NestJS applications. Generate and seed realistic test data with ease using factories, Faker.js, and a simple command-line interface.

### Key Features

- 🖥️ **CLI-First** - Simple commands, no app code changes needed
- 🏭 **Factory Pattern** - Generate realistic data with Faker.js decorators
- 🔄 **Multiple ORMs** - Works with TypeORM, Mongoose, and Prisma
- 🎯 **Selective Seeding** - Run specific seeders or all at once
- 🔥 **Refresh Mode** - Drop and reseed with one command
- 📦 **Batch Operations** - Efficient bulk data insertion
- ✅ **Type-Safe** - Full TypeScript support

## 📦 Installation

```bash
npm install @ackplus/nest-crud @faker-js/faker
npm install -D ts-node typescript
```

## 🚀 Quick Example

**1. Create a factory:**

```typescript
// src/factories/user.factory.ts
import { Factory } from '@ackplus/nest-crud';

export class UserFactory {
  @Factory((faker) => faker.person.fullName())
  name: string;

  @Factory((faker) => faker.internet.email())
  email: string;
}
```

**2. Create a seeder:**

```typescript
// src/seeders/user.seeder.ts
import { Injectable } from '@nestjs/common';
import { Seeder, DataFactory } from '@ackplus/nest-crud';

@Injectable()
export class UserSeeder implements Seeder {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async seed(): Promise<void> {
    const factory = DataFactory.createForClass(UserFactory);
    const users = factory.generate(10);
    await this.repo.save(users);
  }

  async drop(): Promise<void> {
    await this.repo.delete({});
  }
}
```

**3. Create config file (`seeder.config.ts` in project root):**

```typescript
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './src/entities/user.entity';
import { UserSeeder } from './src/seeders/user.seeder';

export default {
  imports: [
    TypeOrmModule.forRoot({ /* db config */ }),
    TypeOrmModule.forFeature([User]),
  ],
  seeders: [UserSeeder],
};
```

**4. Add script and run:**

```json
{
  "scripts": {
    "seed": "nest-seed -c seeder.config.ts"
  }
}
```

```bash
npm run seed
```

**Done! 🎉**

## 📚 Documentation

### Package Documentation

- **[📖 Complete Documentation](./packages/nest-crud/README.md)** - Full guide with all features and examples
- **[⚡ Quick Start (5 min)](./packages/nest-crud/QUICKSTART.md)** - Get up and running fast
- **[🤝 Contributing Guide](./packages/nest-crud/CONTRIBUTING.md)** - Help improve the project
- **[📁 Examples](./packages/nest-crud/examples/)** - Template files you can copy

### Example Application

See a complete working example:
- **[Example App](./apps/example-app/)** - TypeORM + SQLite with tests
- Run: `cd apps/example-app && pnpm seed`

## 🛠️ Local Development

This section is for contributors working on the package itself.

### Setup

```bash
# Clone repository
git clone https://github.com/ackplus/nest-crud.git
cd nest-crud

# Install dependencies
pnpm install

# Build package
pnpm -C packages/nest-crud build

# Run tests
pnpm -C apps/example-app test
```

### Project Structure

```
nest-crud/
├── packages/
│   └── nest-crud/          # 📦 Main package
│       ├── src/              # Source code
│       ├── dist/             # Compiled output
│       ├── examples/         # Example templates
│       └── README.md         # Package documentation
├── apps/
│   └── example-app/          # 🧪 Example application
│       ├── src/              # Working example
│       └── seeder.config.ts  # CLI configuration
├── scripts/
│   └── publish.js            # Publishing script
└── package.json              # Root workspace
```

### Development Workflow

```bash
# Build package
pnpm -C packages/nest-crud build

# Run example app
cd apps/example-app
pnpm seed                # Seed database
pnpm seed:refresh        # Drop and reseed
pnpm seed:watch          # Watch mode
pnpm test                # Run tests
pnpm start:dev           # Start app

# Make changes and test
pnpm -C packages/nest-crud build
pnpm -C apps/example-app test
```

### Watch Mode (Multi-Terminal)

For active development, run these in separate terminals:

```bash
# Terminal 1: Build watch
pnpm -C packages/nest-crud build --watch

# Terminal 2: Test watch
pnpm -C apps/example-app test:watch

# Terminal 3: Seed watch
pnpm -C apps/example-app seed:watch
```

### Publishing

```bash
# Interactive version bump and publish
npm run publish

# The script will:
# 1. Ask for version type (patch/minor/major)
# 2. Build package
# 3. Update version
# 4. Publish to npm
```

## 🧪 Testing

```bash
# Package tests
pnpm -C packages/nest-crud test

# Example app tests
pnpm -C apps/example-app test
pnpm -C apps/example-app test:cov

# E2E tests
pnpm -C apps/example-app test:e2e
```

## 🤝 Contributing

Contributions are welcome! See [Contributing Guide](./packages/nest-crud/CONTRIBUTING.md).

**Quick steps:**
1. Fork the repo
2. Create a branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Build and test (`pnpm -C packages/nest-crud build && pnpm -C apps/example-app test`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](./packages/nest-crud/LICENSE)

## 🔗 Links

- **[NPM Package](https://www.npmjs.com/package/@ackplus/nest-crud)**
- **[GitHub Repository](https://github.com/ackplus/nest-crud)**
- **[Full Documentation](./packages/nest-crud/README.md)**
- **[Quick Start Guide](./packages/nest-crud/QUICKSTART.md)**
- **[Issue Tracker](https://github.com/ackplus/nest-crud/issues)**

---

Made with ❤️ for the NestJS community
