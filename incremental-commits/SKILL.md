---
name: incremental-commits
description: Governs how to commit work when doing software development with this user, across every project on this machine. Use this whenever writing code, implementing a feature, fixing a bug, or making any multi-step change in a git repository — commit in small, logical, step-by-step increments with conventional-commit prefixes instead of batching everything into one big commit at the end. Always consult this before staging/committing changes during development work, even if the user didn't explicitly ask for a commit at that moment.
---

# Incremental Commits

This user wants git history that reads like a story of small, reviewable steps — not a handful of giant commits. Small commits make it easy to spot where something broke, to revert just one piece, and to review a diff without wading through unrelated changes.

## When this applies

Any time you're doing development work in a git repository for this user: implementing a feature, fixing a bug, refactoring, updating config, editing docs, bumping dependencies, touching CI. This is a standing preference, not something to wait to be told each time — treat "let's build X" as implicit authorization to commit as you go, the same way the user would if they were typing the commands themselves.

This does not apply to throwaway exploration, scratch files outside a repo, or repos where the user has said not to commit.

## How to work

1. Break the task into logical steps before you start (a plan or todo list helps). Each step should be a coherent, working unit — e.g. "add the validation function," "wire up the new endpoint," "update the config schema." Not "save file" granularity, and not "the whole feature" granularity.
2. After finishing each step, stage only the files relevant to that step and commit immediately. Don't let multiple unrelated changes pile up uncommitted.
3. Don't wait until the end of the task to commit everything at once — that defeats the purpose. If you catch yourself with a large uncommitted diff spanning several concerns, that's a sign to have split it up already; stop and commit what's ready before continuing.
4. Follow the same safety rules as always: check `git status`/`git diff` before committing, never use `--no-verify` or skip hooks, never force-push, and only commit files that belong to the current step.

## Commit message format

Use conventional-commit-style prefixes, short and to the point — a single line describing what changed, not why in depth (save "why" for the PR description if there is one).

Prefixes to use:
- `feat` — new functionality
- `fix` — bug fix
- `refactor` — code change that doesn't change behavior
- `docs` — documentation only
- `ci` — CI/CD pipeline or workflow changes
- `deps` — dependency additions/updates/removals
- `chore` — everything else (tooling, config, cleanup)
- `test` — adding or updating tests

Format: `<prefix>: <short imperative description>`

**Examples:**
- `feat: add email validation to signup form`
- `fix: handle null response from payment API`
- `refactor: extract retry logic into helper`
- `docs: document the new config flags`
- `ci: cache node_modules in build workflow`
- `deps: bump requests to 2.32.0`
- `chore: remove unused imports`

Keep the subject line short (aim for under ~60 chars). Only add a body if a one-liner genuinely can't convey what changed — and if so, keep it to a line or two, not a paragraph.

## Co-authorship

Do not add a `Co-Authored-By` trailer, or any other Claude/Anthropic attribution line, to commit messages.
