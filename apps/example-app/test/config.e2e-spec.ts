import { hasPgTarget } from './pg-setup';

/**
 * Surfaces WHY the Postgres e2e suites skipped. When no database is configured
 * this test runs (and passes) with a descriptive name, so the output explains the
 * skip instead of a silent "0 of N". When a database IS configured it's skipped
 * and the real suites run.
 */
describe('Postgres e2e configuration', () => {
  (hasPgTarget ? it.skip : it)(
    'no database configured → e2e suites skipped. Set apps/example-app/.env (copy .env.example) or pass DB_HOST/DB_PORT/… — see the README.',
    () => {
      // console output from a running test IS displayed by jest, so this explains
      // the skip in the output (a module-level warn would be swallowed).
      // eslint-disable-next-line no-console
      console.warn(
        '\n⚠️  Postgres e2e SKIPPED — no database configured.\n' +
          '   → copy apps/example-app/.env.example to apps/example-app/.env and set DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME\n' +
          '   → or run inline: DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=nest_crud_example pnpm -C apps/example-app test:e2e\n',
      );
      expect(hasPgTarget).toBe(false);
    },
  );
});
