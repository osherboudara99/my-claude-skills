---
name: jev-review
description: Use when a code change is ready for review and you want an automated check that the diff actually matches the original request — surfaces unrelated changes, missing requirements, or security concerns before the assistant hands the work back, using TypeSafe's Jev judgment model.
---

# Jev Review

Sends the original development request and the relevant git diff to TypeSafe's
Jev model, gets back four probability judgments (aligned / unrelated changes /
missing requirements / security concern), and uses those as a signal for the
assistant to investigate and fix, not as a verdict to just report.

**REQUIRED:** `TYPESAFE_API_KEY` must be set in the environment. If it's not,
tell the user and stop — don't fabricate a result.

## Steps

1. **Collect the original request.** Pull it from the conversation — the
   feature/fix/change the user actually asked for, in their words. Write it to
   a temp file (e.g. `/tmp/jev-request.txt`).
2. **Collect the relevant diff.** Use whichever `git diff` represents the
   change under review (uncommitted work, a staged diff, or a branch vs.
   `main` — pick based on what's actually being evaluated). Write it to a temp
   file (e.g. `/tmp/jev-diff.txt`). If the diff is huge (>1000 lines), review
   the most relevant hunks rather than sending the entire thing.
3. **Run the script:**
   ```bash
   python3 ~/.claude/skills/jev-review/jev_review.py \
     --request-file /tmp/jev-request.txt \
     --diff-file /tmp/jev-diff.txt
   ```
   This makes one API call and prints JSON like:
   ```json
   {
     "answers": {
       "is_aligned": {"type": "noul", "noul": 0.92},
       "has_unrelated_changes": {"type": "noul", "noul": 0.10},
       "has_missing_requirements": {"type": "noul", "noul": 0.05},
       "has_security_concern": {"type": "noul", "noul": 0.02}
     }
   }
   ```
4. **Threshold and report.** Flag a dimension when its probability crosses
   0.6 (`has_unrelated_changes`, `has_missing_requirements`,
   `has_security_concern`) or when `is_aligned` is *below* 0.6. Present a
   short structured summary to the user: aligned or not, and which concerns
   were flagged, each with its probability.
5. **Investigate flagged items yourself.** Jev returns a probability, not a
   reason — it has no explanation to relay. For each flag, read the diff and
   the request again to find the specific hunk or omission that justifies it.
   Don't just repeat the probability back to the user.
6. **Offer to fix.** Once you've identified the concrete issue, propose a
   fix and, if the user agrees, implement it with your normal editing tools.

## Notes

- The script is stateless and has no retry/backoff logic — on `429`/`529` it
  just reports the error; rerun manually if needed.
- To extend with another dimension (e.g. "breaks existing tests"), add another
  `noul` entry to the `QUESTIONS` dict in `jev_review.py` — no other changes
  needed.
