import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

import * as api from '../index';

const pkgRoot = resolve(__dirname, '../..');
const repoRoot = resolve(pkgRoot, '../..');
const cli = join(pkgRoot, 'bin/nest-crud-request.js');
const skill = readFileSync(join(pkgRoot, 'skills/nest-crud-request/SKILL.md'), 'utf8');
const run = (args: string[]) => execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

/** The AI-assistant skill that ships in this package, and its `add-skill` command. */
describe('AI skill + add-skill command', () => {
    jest.setTimeout(30000); // each case starts a Node process
    let dir: string;
    beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'ncr-skill-')); });
    afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

    it('has valid front matter and stays small', () => {
        expect(skill).toMatch(/^---\nname: nest-crud-request\ndescription: .+\n---\n/);
        expect(skill.split('\n').length).toBeLessThan(200);
    });

    it('only names operators and builder methods that exist', () => {
        const table = skill.slice(skill.indexOf('## Operators'), skill.indexOf('## Which route'));
        const ops = [...table.matchAll(/`([A-Z][A-Z_]+)`/g)].map((m) => m[1]);
        expect(ops.length).toBeGreaterThan(20);
        for (const op of ops) expect(api.WhereOperatorEnum).toHaveProperty(op);
        const methods = [...skill.matchAll(/\.(where|andWhere|orWhere|addRelation|addOrder|setTake|setSkip|addAggregate|having|setOnlyDeleted|setWithDeleted|toObject|toJson|removeSelect|removeRelation|removeOrder|removeAggregate)\(/g)].map((m) => m[1]);
        const qb: any = new api.QueryBuilder();
        for (const m of new Set(methods)) expect(typeof qb[m]).toBe('function');
    });

    it('the package publishes the skill and the command; the docs copy matches', () => {
        const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));
        expect(pkg.files).toEqual(expect.arrayContaining(['bin', 'skills']));
        expect(pkg.bin['nest-crud-request']).toBe('./bin/nest-crud-request.js');
        expect(readFileSync(join(repoRoot, 'docs/public/skill-request.md'), 'utf8')).toBe(skill);
    });

    it('writes the Claude skill and its own AGENTS.md block, leaving other content alone', () => {
        writeFileSync(join(dir, 'AGENTS.md'), '# App\n\n<!-- nest-crud:start -->\nserver skill\n<!-- nest-crud:end -->\n');
        run(['add-skill', '--dir', dir]);
        run(['add-skill', '--dir', dir]);
        expect(readFileSync(join(dir, '.claude/skills/nest-crud-request/SKILL.md'), 'utf8')).toBe(skill);
        const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
        expect(agents).toContain('<!-- nest-crud:start -->\nserver skill\n<!-- nest-crud:end -->'); // other block kept
        expect(agents.split('<!-- nest-crud-request:start -->').length).toBe(2); // one block of ours
    });

    it('--print writes nothing; an unknown tool fails', () => {
        expect(run(['add-skill', '--dir', dir, '--print'])).toBe(skill);
        expect(existsSync(join(dir, 'AGENTS.md'))).toBe(false);
        expect(() => execFileSync(process.execPath, [cli, 'add-skill', '--tool', 'nope'], { stdio: 'pipe' })).toThrow();
    });
});
