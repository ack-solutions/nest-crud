#!/usr/bin/env node
'use strict';

// `npx @ackplus/nest-crud-request add-skill` — copies the AI-assistant skill that ships with
// this package into the current project. It only writes when you run it.

const fs = require('fs');
const path = require('path');

const SKILL_FILE = path.join(__dirname, '..', 'skills', 'nest-crud-request', 'SKILL.md');
const MARK_START = '<!-- nest-crud-request:start -->';
const MARK_END = '<!-- nest-crud-request:end -->';

const TARGETS = {
    claude: { file: '.claude/skills/nest-crud-request/SKILL.md', label: 'Claude Code skill' },
    cursor: { file: '.cursor/rules/nest-crud-request.mdc', label: 'Cursor rule' },
    agents: { file: 'AGENTS.md', label: 'AGENTS.md section', section: true },
    copilot: { file: '.github/copilot-instructions.md', label: 'Copilot instructions section', section: true },
};

function help() {
    console.log(`Usage: npx @ackplus/nest-crud-request add-skill [options]

Installs the @ackplus/nest-crud-request skill for AI coding assistants into this project.

Options:
  --tool <name>   claude | cursor | agents | copilot | all   (default: claude + agents)
  --dir <path>    project directory (default: current directory)
  --print         print the skill to stdout instead of writing files
  -h, --help      show this help`);
}

function parse(argv) {
    const out = { command: argv[0], tools: [], dir: process.cwd(), print: false, help: false };
    for (let i = 1; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--tool') out.tools.push(...String(argv[++i] || '').split(','));
        else if (a === '--dir') out.dir = path.resolve(String(argv[++i] || '.'));
        else if (a === '--print') out.print = true;
        else if (a === '-h' || a === '--help') out.help = true;
        else throw new Error(`Unknown option: ${a}`);
    }
    return out;
}

/** The skill body without its YAML front matter (for tools that don't use it). */
function body(skill) {
    return skill.replace(/^---\n[\s\S]*?\n---\n+/, '');
}

function writeWhole(file, content) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
}

/** Insert or replace our marked block, leaving the rest of the file untouched. */
function writeSection(file, content) {
    const block = `${MARK_START}\n${content.trim()}\n${MARK_END}\n`;
    let current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const start = current.indexOf(MARK_START);
    const end = current.indexOf(MARK_END);
    if (start !== -1 && end > start) {
        current = current.slice(0, start) + block + current.slice(end + MARK_END.length).replace(/^\n/, '');
    } else {
        current = (current.trim() ? current.replace(/\n*$/, '\n\n') : '') + block;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, current);
}

function main() {
    const args = parse(process.argv.slice(2));
    if (args.help || !args.command) return help();
    if (args.command !== 'add-skill') throw new Error(`Unknown command: ${args.command}`);

    const skill = fs.readFileSync(SKILL_FILE, 'utf8');
    if (args.print) return process.stdout.write(skill);

    let tools = args.tools.filter(Boolean);
    if (tools.length === 0) tools = ['claude', 'agents'];
    if (tools.includes('all')) tools = Object.keys(TARGETS);

    for (const tool of tools) {
        const target = TARGETS[tool];
        if (!target) throw new Error(`Unknown tool: ${tool} (use ${Object.keys(TARGETS).join(', ')}, all)`);
        const file = path.join(args.dir, target.file);
        if (target.section) {
            writeSection(file, body(skill));
        } else if (tool === 'cursor') {
            writeWhole(file, `---\ndescription: How to query a nest-crud API with @ackplus/nest-crud-request\nalwaysApply: false\n---\n\n${body(skill)}`);
        } else {
            writeWhole(file, skill);
        }
        console.log(`✓ ${target.label}: ${path.relative(args.dir, file)}`);
    }
    console.log('\nRe-run after upgrading @ackplus/nest-crud-request to refresh it.');
}

try {
    main();
} catch (err) {
    console.error(`nest-crud-request: ${err.message}\n`);
    help();
    process.exit(1);
}
