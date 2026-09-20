---
name: branch-naming
description: Governs how to name new git branches for this user, across every project on this machine. Use this whenever creating a new branch to start a feature, fix, refactor, or any other piece of dev work — branches must start with a conventional prefix followed by a short kebab-case summary of the change, instead of arbitrary or ticket-only names.
---

# Branch Naming

This user wants branch names that tell you what kind of change is coming and what it's about, at a glance, without opening the branch.

## When this applies

Any time you're about to create a new branch (`git checkout -b ...`, `git branch ...`, or via a hosting platform) for dev work. Treat this the same way as [[incremental-commits]] — a standing preference, not something to confirm each time.

## Format

```
<prefix>/<short-kebab-summary>
```

- **prefix**: one of the same conventional-commit prefixes used for commit messages — `feat`, `fix`, `refactor`, `docs`, `ci`, `deps`, `chore`, `test`. Pick the prefix that matches the dominant nature of the work, the same way you'd pick it for a commit message.
- **short-kebab-summary**: a few words, lowercase, hyphen-separated, describing the change itself — not a ticket number, not the user's name, not a date. Summarize *what the branch does*, e.g. `retry-logic-for-uploads`, not `johns-branch` or `update`.

**Examples:**
- `feat/email-validation`
- `fix/null-payment-response`
- `refactor/extract-retry-helper`
- `docs/config-flags`
- `ci/cache-node-modules`
- `deps/bump-requests`

## Notes

- Only the prefix is fixed vocabulary — don't invent new prefixes on the fly, and don't skip the prefix even for small changes.
- If the work doesn't cleanly fit one prefix (e.g. a fix that also updates docs), pick whichever is the primary intent of the branch.
- If the user gives you a ticket/issue number or an explicit name, incorporate it after the prefix rather than overriding their choice entirely, e.g. `fix/123-null-payment-response`.
