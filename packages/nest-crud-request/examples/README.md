# Frontend Examples - @ackplus/nest-crud-request

This directory contains comprehensive examples demonstrating how to use `@ackplus/nest-crud-request` in frontend applications.

## Examples

1. [React Examples](./react/) - React with hooks, TypeScript, and various patterns
2. [Angular Examples](./angular/) - Angular services and components
3. [Vue Examples](./vue/) - Vue 3 Composition API
4. [Vanilla JavaScript](./vanilla/) - Pure JavaScript examples

## Quick Start

The `@ackplus/nest-crud-request` package is framework-agnostic and can be used in any JavaScript/TypeScript environment.

### Installation

```bash
npm install @ackplus/nest-crud-request
```

### Basic Usage

```typescript
import { QueryBuilder, WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-crud-request';

// Build a query
const query = new QueryBuilder()
  .where('isActive', WhereOperatorEnum.EQ, true)
  .setSkip(0)
  .setTake(10)
  .addOrder('createdAt', OrderDirectionEnum.DESC);

// Convert to query parameters
const params = query.toObject();

// Use with fetch
const response = await fetch(`/api/users?${new URLSearchParams(params)}`);
const users = await response.json();
```

## Framework-Specific Examples

- **React**: See [react/](./react/) directory
- **Angular**: See [angular/](./angular/) directory
- **Vue**: See [vue/](./vue/) directory
- **Vanilla JS**: See [vanilla/](./vanilla/) directory

