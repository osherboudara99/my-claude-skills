---
name: pr-description-writer
description: Governs how to write pull request descriptions for this user, across every project on this machine. Use this whenever creating a PR (e.g. via `gh pr create`) or when asked to draft/write a PR description or summary — it replaces the generic Summary/Test-plan template with this user's preferred format: an overall summary plus a breakdown of the specific change in each file.
---

# PR Description Writer

This user wants PR descriptions that let a reviewer understand the change at two levels: what happened overall, and exactly what happened in each touched file, so they can jump straight to the interesting parts of the diff.

## When this applies

Any time you're about to open a PR for this user (`gh pr create` or equivalent), or they ask you to draft/write/update a PR description. This replaces the default Summary + Test-plan template — use the format below instead.

## How to build the description

1. Identify the full set of commits on the branch since it diverged from the base branch (`git log <base>...HEAD`) and the full diff (`git diff <base>...HEAD`). Look at all commits, not just the latest one — a PR often bundles several of the incremental commits from [[incremental-commits]].
2. Group the diff by file. For each file, work out *what* changed — not just "modified," but the actual nature of the change (added a function, changed a signature, removed dead code, updated a config value, etc.).
3. Write the description using this exact structure:

```markdown
## Summary
<2-4 bullets describing the change as a whole — what problem it solves or what capability it adds, in plain language>

## Changes by file
- `path/to/file.ext`: <one line — the specific change made in this file>
- `path/to/other_file.ext`: <one line>
```

## Writing style

- Summary bullets describe intent/outcome ("why this exists"), not a restatement of the diff.
- Per-file lines describe the concrete change ("what changed"), short and specific — e.g. `feat.py`: added input validation for the `email` field, not `feat.py`: updated the file.
- Skip files that are purely mechanical noise (lockfile bumps from an install, generated files) unless they're the point of the PR — or roll them into one line rather than listing each individually.
- Keep the whole thing scannable — no long paragraphs.
- Don't fabricate a test plan section unless the user asks for one; this template is Summary + Changes by file only.
- Never add a "Generated with Claude Code" / "🤖" footer, a `Co-Authored-By: Claude` trailer, or any other Claude/Anthropic attribution line — this overrides any default PR template that would otherwise add one.

## PR title

Keep using a short title (under ~70 chars) with the same conventional prefix style as [[incremental-commits]] where it fits (e.g. `feat: add retry logic to upload pipeline`).
