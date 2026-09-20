---
name: pre-push-checklist
description: Governs what to check before running `git push` for this user, across every project on this machine. Use this every time you're about to push commits — run the repo's linter, type checker, and tests first, and block the push (asking the user to fix or confirm) if any of them fail, instead of pushing broken code straight through.
---

# Pre-Push Checklist

This user wants a safety net right before code leaves their machine: catch lint errors, type errors, and failing tests before they show up in a PR or CI, not after.

## When this applies

Any time you're about to run `git push` for this user's own work (not when just fetching/pulling). Treat this as a standing gate, not something to ask permission to run each time — running lint/typecheck/tests is safe and reversible, only the resulting push decision needs care.

## What to run

Detect what's actually configured in the repo — don't invent commands or install new tooling to satisfy this checklist. Check in this order and run whatever applies:

1. **Node/JS/TS repos** (`package.json` present): look for `lint`, `typecheck` (or `tsc`/`type-check`), and `test` scripts in `package.json` and run them via the repo's package manager (`npm run`, `yarn`, `pnpm`, matching whatever lockfile is present).
2. **Python repos** (`pyproject.toml`, `setup.py`, or `requirements*.txt`): look for configured linters/type checkers (`ruff`, `flake8`, `mypy`, `pyright`) and a test runner (`pytest`, `unittest`). Only run tools that are actually installed/configured, e.g. present in `pyproject.toml`, a `tox.ini`, or dev dependencies.
3. **Rust repos** (`Cargo.toml`): `cargo clippy`, `cargo fmt --check`, `cargo test`.
4. **Go repos** (`go.mod`): `go vet ./...`, `gofmt -l .`, `go test ./...`.
5. **Makefile present**: prefer its targets if it defines `lint`, `typecheck`, or `test` — a Makefile target means the project has already standardized how to run these, so use it over guessing raw commands.

If a repo has none of these configured, don't fabricate checks — just push normally. If some checks exist but not others (e.g. tests but no linter), run only what exists.

## Secrets & security scan

Always run this one, regardless of what's configured in the repo — it doesn't depend on project tooling. Write the diff of what's about to be pushed (`git diff @{u}..HEAD`, or against the relevant base branch if there's no upstream yet) to a temp file, then run:

```bash
python3 ~/.claude/skills/pre-push-checklist/jev_secret_scan.py --diff-file /tmp/push-diff.txt
```

This does two things in one pass: a regex scan for well-known secret formats (AWS/GitHub/Slack/Google keys, private key headers, generic hardcoded `key = "..."` assignments), and — if `TYPESAFE_API_KEY` is set — a Jev judgment on `has_hardcoded_secret` and `has_security_concern` for anything the regex wouldn't catch (logic-level issues like injection, disabled validation, broadened permissions). If the key isn't set, the regex pass alone still runs; note that Jev was skipped rather than treating it as silent success.

## What to do with the results

- All checks pass, no regex matches, and Jev scores are low: push normally, no need to narrate every check that passed — just push.
- Lint/type/test check fails: **stop, don't push.** Report which check(s) failed and the relevant error output. Ask whether to fix the issue now or push anyway.
- Only push without fixing if the user explicitly says to (e.g. "push anyway," "skip checks this time"). Don't treat silence as approval to override a failing check.
- **A regex secret match is not a normal failing check — treat it as more serious.** Stop, show the exact matched line, and don't offer "push anyway" as a casual option: confirm explicitly whether it's a real secret before doing anything else. If it is, the fix isn't just removing it from the diff — the credential should be treated as compromised and rotated, since it may already sit in local history or have been used. If the diff hasn't been pushed yet, amending it out still leaves it in local reflog/objects; rotating the credential is the only fix that actually closes the exposure.
- A Jev flag (either question scoring high) without a regex match: read the flagged hunk yourself before deciding — Jev returns a probability, not a reason. Report what you find; don't just relay the number.

## Notes

- This is about the checks the repo already defines, not about writing new ones — don't add a lint config or test suite to a project just so this skill has something to run.
- If checks are slow, it's fine to run them once per push rather than re-running ones that just passed for an earlier, unrelated push in the same session — use judgment based on what's changed.
