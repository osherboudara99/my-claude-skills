---
name: verify
description: Tests application code just written for bugs and confirms it actually fulfills the user's stated intent, by running it in an isolated sandboxed git worktree. Use when the user invokes /verify, or asks to "verify this works", "sandbox test this", "does this actually do what I wanted", or similar, after code has been written or changed. Spawns an isolated subagent that builds, lints, type-checks, tests, and actually runs/exercises the app, then cross-checks the result against the conversation's stated goals plus any spec/README/plan .md files in the repo.
---

# Verify

This user wants a second, adversarial pass on code Claude just wrote: not just "does it compile," but "does it actually work when run, and does it do the thing I asked for." The check must happen in an isolated sandbox (a separate git worktree) so it can freely install dependencies, run the app, and even let it crash without touching the user's working directory or uncommitted changes.

## When this applies

Manual only — run this when the user explicitly invokes `/verify` or clearly asks for this kind of check (e.g. "verify that works," "sandbox test this," "confirm this matches what I wanted"). Do not run it automatically after every edit; that's a different workflow this user has not asked for.

## Step 1: Gather what "the vision" is

Before spawning the sandbox agent, assemble the intent to check against — you have context the sandbox agent won't:

- The relevant parts of this conversation: what the user actually asked for, any constraints or edge cases they mentioned, anything they corrected along the way.
- Any `.md` files in the repo that describe intent or requirements — `README.md`, `CLAUDE.md`, `SPEC.md`, `PLAN.md`, files under `docs/`, or any other markdown that looks like a spec, plan, or design doc. Skim for relevance; don't dump every `.md` file if the repo has hundreds — prioritize ones near the changed code or with obviously relevant names.
- The current diff / recently changed files (`git status`, `git diff`) so the sandbox agent knows exactly what's new versus pre-existing.

## Step 2: Spawn the sandboxed agent

Use the `Agent` tool with `isolation: "worktree"` and `subagent_type: "general-purpose"` (needs full tool access — Bash, Read, Skill, etc.). Run it in the foreground (`run_in_background: false`) since the user is waiting on a verdict before continuing.

Write a self-contained prompt (the agent has no memory of this conversation) that includes:

1. **What was supposed to be built** — a concise restatement of the user's goal, in your own words, plus direct quotes of any specific requirements/constraints from the conversation.
2. **What changed** — the diff or list of changed files, and which repo/directory.
3. **Pointers to spec material** — paths to any `.md` files worth reading for intent.
4. **Explicit instructions to:**
   - Install dependencies and build the project in the worktree.
   - Run whatever linter, type checker, and test suite the repo already has configured (detect from `package.json`/`pyproject.toml`/`Cargo.toml`/`go.mod`/Makefile — don't invent tooling that isn't there).
   - Actually run the application and exercise the golden path plus obvious edge cases — not just static checks. If a `run` skill is available, use it to figure out how to launch the app (web server, CLI, TUI, etc.); otherwise infer from the project type.
   - Compare observed behavior against the stated vision: does it do what was asked, including edge cases the user mentioned? Note any gap, not just crashes — a feature that runs without error but doesn't match what was requested is still a failure.
   - Not fix anything — this is a verification pass, not a repair pass. It should report, not edit source files (aside from whatever the build/install step naturally writes, e.g. lockfiles/build artifacts in the worktree).
5. **Requested report format:** a pass/fail verdict, a list of concrete bugs found (with repro steps/commands and output), and a list of any mismatches between behavior and stated intent — each specific enough that the user could hand it to someone else and have them reproduce it.

## Step 3: Relay the result

Summarize the subagent's report for the user in a few sentences plus a short list — don't paste its raw output verbatim. Lead with the verdict (works and matches intent / works but doesn't match intent / broken), then the specifics.

- If everything passes: say so briefly, no need to pad it out.
- If there are bugs or mismatches: list them concretely, and ask whether to fix now — don't start editing source files as part of this skill without being asked, since verification and fixing are separate steps.

## Notes

- The worktree isolation means a failed or crashing run is safe — encourage the sandbox agent to actually let the app run rather than only doing static analysis, since that's the whole point of the sandbox.
- If the repo has no build/run path at all (e.g. a pure library with only unit tests), running the test suite plus a manual exercise of the public API in a scratch script is an acceptable substitute for "running the app."
- Don't skip the vision check even when all technical checks pass — code that builds, lints, and passes tests can still not do what the user asked.
