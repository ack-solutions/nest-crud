import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const pkgRoot = resolve(__dirname, '../../..');
const repoRoot = resolve(pkgRoot, '../..');
const cli = join(pkgRoot, 'bin/nest-crud.js');
const skillPath = join(pkgRoot, 'skills/nest-crud/SKILL.md');
const skill = readFileSync(skillPath, 'utf8');

const run = (args: string[]) => execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

/** The AI-assistant skill that ships in the package, and the `add-skill` command. */
describe('AI skill + add-skill command', () => {
    jest.setTimeout(30000); // each case starts a Node process
    let dir: string;
    beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'nest-crud-skill-')); });
    afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

    it('the skill has valid front matter and stays small', () => {
        expect(skill).toMatch(/^---\nname: nest-crud\ndescription: .+\n---\n/);
        expect(skill.split('\n').length).toBeLessThan(200);
    });

    it('the package publishes the skill and the command', () => {
        const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));
        expect(pkg.files).toEqual(expect.arrayContaining(['bin', 'skills']));
        expect(pkg.bin['nest-crud']).toBe('./bin/nest-crud.js');
    });

    it('the docs-site copy is identical to the packaged skill', () => {
        expect(readFileSync(join(repoRoot, 'docs/public/skill.md'), 'utf8')).toBe(skill);
    });

    it('default: writes the Claude skill and an AGENTS.md section', () => {
        run(['add-skill', '--dir', dir]);
        expect(readFileSync(join(dir, '.claude/skills/nest-crud/SKILL.md'), 'utf8')).toBe(skill);
        const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
        expect(agents).toContain('<!-- nest-crud:start -->');
        expect(agents).not.toContain('name: nest-crud'); // front matter stripped
    });

    it('keeps existing AGENTS.md content and replaces only its own block on re-run', () => {
        writeFileSync(join(dir, 'AGENTS.md'), '# My project\n\nHouse rules.\n');
        run(['add-skill', '--dir', dir, '--tool', 'agents']);
        run(['add-skill', '--dir', dir, '--tool', 'agents']);
        const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
        expect(agents.startsWith('# My project\n\nHouse rules.\n')).toBe(true);
        expect(agents.split('<!-- nest-crud:start -->').length).toBe(2); // exactly one block
    });

    it('--tool all writes every target; --print writes nothing', () => {
        run(['add-skill', '--dir', dir, '--tool', 'all']);
        for (const f of ['.claude/skills/nest-crud/SKILL.md', '.cursor/rules/nest-crud.mdc', 'AGENTS.md', '.github/copilot-instructions.md']) {
            expect(existsSync(join(dir, f))).toBe(true);
        }
        const other = mkdtempSync(join(tmpdir(), 'nest-crud-skill-'));
        expect(run(['add-skill', '--dir', other, '--print'])).toBe(skill);
        expect(existsSync(join(other, 'AGENTS.md'))).toBe(false);
        rmSync(other, { recursive: true, force: true });
    });

    it('an unknown tool fails with a non-zero exit', () => {
        expect(() => execFileSync(process.execPath, [cli, 'add-skill', '--dir', dir, '--tool', 'nope'], { stdio: 'pipe' })).toThrow();
    });
});
