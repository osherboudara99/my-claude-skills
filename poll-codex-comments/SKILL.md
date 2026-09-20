---
name: poll-codex-comments
description: Use after opening or updating a GitHub PR that has the chatgpt-codex-connector[bot] automated reviewer enabled. Polls the PR's review comments until Codex has posted (or a timeout is hit), then triages the findings instead of leaving the user to check back manually.
---

# Poll for Codex Comments

This user has automated Codex PR review (`chatgpt-codex-connector[bot]`) enabled on their repos. Codex doesn't comment instantly — it reviews asynchronously after a PR is opened or pushed to. This user wants Claude to wait for that review and triage it, not just open the PR and stop.

## When this applies

Any time you open a new PR, or push a new commit to an existing PR's branch, in a repo where Codex review is active (you'll know it's active if `chatgpt-codex-connector[bot]` shows up in prior PR comment authors, or the user says so). Treat polling as the natural last step of "open a PR" — not something to ask permission for.

## How to poll

Use the GitHub REST API directly rather than `gh pr view` (which doesn't surface bot review comments well):

```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments
```

Codex comments come from `chatgpt-codex-connector[bot]` and typically carry a `P1`/`P2` severity badge in the comment body. General PR-level (non-inline) comments can also show up via:

```bash
gh api repos/{owner}/{repo}/issues/{number}/comments
```

Check both endpoints — inline code comments land on `/pulls/.../comments`, general review-summary comments land on `/issues/.../comments`.

**Polling loop:** Codex reviews typically land within a few minutes. Don't busy-poll — check, and if nothing's there yet, wait before checking again rather than hammering the API:

- First check: immediately after the PR is opened/updated (comments may already exist from a prior push).
- If empty: wait ~60-90s, check again.
- Repeat up to ~5-6 times (roughly 5-8 minutes total) before giving up and telling the user Codex hasn't responded yet.
- If the session supports scheduling a wakeup (e.g. `ScheduleWakeup`) instead of blocking with `sleep`, prefer that over a long-running blocked bash call — don't chain manual `sleep` loops.

## What to do with results

1. **Fetch and read every comment** attributed to `chatgpt-codex-connector[bot]` — don't stop at the first one.
2. **Score the batch with Jev, then triage.** If `TYPESAFE_API_KEY` is set, write the PR diff and the fetched comments (as a JSON array of `{id, body, path, line}`) to temp files and run:
   ```bash
   python3 ~/.claude/skills/poll-codex-comments/jev_triage_comments.py \
     --diff-file /tmp/pr-diff.txt \
     --comments-file /tmp/pr-comments.json
   ```
   This returns `{"scores": {"<comment id>": 0.0-1.0, ...}}` — one probability per comment that it's a real, actionable issue rather than a false positive or nit. Treat this as a **prior that sets triage order, not a verdict**: read every comment regardless of score, lead with the highest-scored ones, and don't auto-dismiss a low score without your own reasoning — Jev has no reasoning to relay, only the number. If the key isn't set, skip straight to manual triage.
   State your triage reasoning briefly for each comment, including how it relates to (or overrides) the Jev score.
3. **Fix real findings** the same way you'd fix any bug in this codebase — following TDD/incremental-commit conventions already in place for the repo, on the same PR branch.
4. **Report back concisely**: which findings were real and fixed, which were dismissed and why. Don't just paste the raw comments back at the user.
5. If Codex flags something that's a deliberate design choice (already discussed with the user, or documented in a spec), dismiss it with that context rather than "fixing" something that isn't broken.

## Notes

- Don't merge a PR while unaddressed P1 findings are outstanding without flagging them to the user first.
- Re-run this same polling step after pushing any fix commit — Codex re-reviews on new pushes, and the user wants to know if the fix satisfied it or introduced something new.
