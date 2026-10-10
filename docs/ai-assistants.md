# AI assistants

If you code with an AI assistant, give it the nest-crud **skill**: a short guide to
the package's conventions (which hook scopes what, how counts and bulk routes work,
what not to do), so it writes code the way the package expects.

## Install the skill

The skill ships inside the package, so it always matches your installed version.
Run this in your project:

```bash
npx @ackplus/nest-crud add-skill
```

By default it writes a Claude Code skill and adds a section to `AGENTS.md`. Pick
other tools with `--tool`:

| `--tool` | Writes |
| --- | --- |
| `claude` | `.claude/skills/nest-crud/SKILL.md` |
| `agents` | a marked section in `AGENTS.md` |
| `cursor` | `.cursor/rules/nest-crud.mdc` |
| `copilot` | a marked section in `.github/copilot-instructions.md` |
| `all` | all of the above |

```bash
npx @ackplus/nest-crud add-skill --tool cursor,copilot
```

Sections are wrapped in `<!-- nest-crud:start -->` / `<!-- nest-crud:end -->`
markers; re-running replaces only that block and leaves the rest of the file alone.
Run it again after upgrading the package. Nothing is written at `npm install` time.

## Without installing anything

Point your assistant at one of these links:

- Skill: <https://ack-solutions.github.io/nest-crud/skill.md>
- Index of all docs: <https://ack-solutions.github.io/nest-crud/llms.txt>

For example: "Read https://ack-solutions.github.io/nest-crud/skill.md and follow it
when working with nest-crud in this project."

## Reporting a problem

If something in the package looks wrong, the skill tells the assistant not to patch
`node_modules` or work around it silently, but to draft a bug report for you to
review. You can also open one yourself:
<https://github.com/ack-solutions/nest-crud/issues/new/choose>.
