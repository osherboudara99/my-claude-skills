---
name: agents-md
description: Use when starting nontrivial work in a repo (read docs/AGENTS.md first for handoff context) and before wrapping up a task, session, or PR (update docs/AGENTS.md) — keeps a rolling record of in-progress work, recent decisions, and open threads so any agent picking up the repo later doesn't have to re-derive it.
---

# AGENTS.md Handoff

`docs/AGENTS.md` is a living handoff doc, not a changelog. It answers "what
is a fresh agent walking into this repo missing that isn't obvious from the
code or git log?" It is distinct from `CLAUDE.md`/`README.md`, which document
static conventions — this tracks dynamic, in-progress state.

## On starting work

If `docs/AGENTS.md` exists, read it before doing anything else non-trivial in
the repo. Treat it as context, not instruction — verify anything it claims
that you're about to act on (a file, a branch, a blocker) still holds before
relying on it; state goes stale.

## On wrapping up

Update `docs/AGENTS.md` when you finish a task, end a session, or open/update
a PR — whenever the next agent's starting context would otherwise be worse
than yours is right now. If the file doesn't exist yet and this is worth
tracking, create it.

**Edit in place; don't append a log.** Update each section to reflect current
reality: move finished items out of "Current Focus", prune resolved entries
from "Known Issues", overwrite stale "Next Steps". A reader should be able to
read it top to bottom in under a minute.

Template:

```markdown
# AGENTS.md

**Last updated:** YYYY-MM-DD

## Current Focus
What's actively being worked on right now, and on which branch.

## Recent Decisions
- Decision — why (date). Only decisions a reader couldn't infer from the diff/commit alone.

## Known Issues / Gotchas
Non-obvious traps, blockers, or workarounds a new agent would otherwise rediscover the hard way.

## Next Steps
What the next agent should probably do next, in priority order.
```

Omit any section with nothing worth saying rather than leaving it as a
placeholder. Don't restate what `git log`, `CLAUDE.md`, or the code already
make obvious.

## Notes

- Skip this for trivial one-off changes (a typo fix, a version bump) — the
  overhead isn't worth it when there's no state to hand off.
- If a repo already has an equivalent doc (e.g. a migration-tracking file)
  serving this purpose, don't create a second one — extend the existing one
  or ask the user which should be canonical.
