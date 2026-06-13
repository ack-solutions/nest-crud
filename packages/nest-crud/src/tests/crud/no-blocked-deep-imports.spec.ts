import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve, relative } from 'path';

/**
 * Regression guard for the "@nestjs/swagger@11 exports map blocks deep imports" bug.
 *
 * Modern @nestjs packages restrict their `exports` to public entry points — e.g.
 * @nestjs/swagger@11 exposes only `.`, `./plugin`, and `./package.json`. Importing
 * an internal build path like `@nestjs/swagger/dist/constants` COMPILES FINE (tsc
 * ignores `exports`) but throws `ERR_PACKAGE_PATH_NOT_EXPORTED` at runtime for any
 * consumer on that version. A build won't catch it, so this test does: it fails if
 * any source file imports a `/dist/` or `/lib/` subpath of a @nestjs package.
 */
describe('no blocked deep imports into @nestjs internals', () => {
    const libDir = resolve(__dirname, '../../lib');

    // A *quoted* specifier `'@nestjs/<pkg>/dist/…'` or `'…/lib/…'` (import or
    // require). The leading quote means doc comments using backticks won't match.
    const BLOCKED = /['"]@nestjs\/[^'"]+\/(dist|lib)\//;

    function walk(dir: string): string[] {
        return readdirSync(dir).flatMap((name) => {
            const full = join(dir, name);
            return statSync(full).isDirectory() ? walk(full) : [full];
        });
    }

    it('imports only public @nestjs entry points (no /dist or /lib subpaths)', () => {
        const offenders: string[] = [];

        for (const file of walk(libDir)) {
            if (!file.endsWith('.ts')) continue;
            readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
                if (BLOCKED.test(line)) {
                    offenders.push(`${relative(libDir, file)}:${i + 1}  ${line.trim()}`);
                }
            });
        }

        // Listed offenders (if any) name the exact file:line to fix.
        expect(offenders).toEqual([]);
    });

    it('the guard regex actually catches the known-bad import', () => {
        // Sanity check so the guard can't silently rot into a no-op.
        expect(BLOCKED.test(`import { DECORATORS } from '@nestjs/swagger/dist/constants';`)).toBe(true);
        expect(BLOCKED.test(`const x = require('@nestjs/swagger/dist/constants');`)).toBe(true);
        // Public entry points and backtick doc-comments must NOT trip it.
        expect(BLOCKED.test(`import { ApiProperty } from '@nestjs/swagger';`)).toBe(false);
        expect(BLOCKED.test(` * NOT import them from \`@nestjs/swagger/dist/constants\``)).toBe(false);
    });
});
