# my-claude-skills

My personal [Claude Code](https://claude.com/claude-code) **skills** and **mods** (plugins that
change Claude Code's own interface).

- **Skills** are instructions Claude follows for a kind of task. Each one is a folder with a `SKILL.md`.
- **Mods** are code that hooks into Claude Code itself (UI bands, slash commands, tool hooks). They live in
  `mods/` and are installed through this repo's plugin marketplace.

## Mods

| Mod | What it does |
| --- | --- |
| [`token-meter`](mods/token-meter) | A row above the prompt showing tokens (input / output / cache), cost and $/turn, context-window fill and plan usage limits. Counters cover the conversation since it started or since the last `/clear`, which resets them. On a resumed session the full session bill is shown beside the cost. Toggle it with `/tokens` (`/tokens on`, `/tokens off`). |

### Install a mod

In a Claude Code terminal session:

```
/plugin install token-meter --marketplace osherboudara99/my-claude-skills
```

Or from a shell:

```sh
claude plugin install token-meter --marketplace osherboudara99/my-claude-skills
```

Answer `y` to add the marketplace, then press Enter to install at user scope. The mod is active right
away and in every session after.

In the Claude desktop app, where `/plugin` doesn't run: click **+** next to the prompt box →
**Plugins** → **Add marketplace** with `osherboudara99/my-claude-skills` → **Add plugin**.

To remove it: `claude plugin uninstall token-meter@my-claude-skills`.

## Skills

| Skill | What it does |
| --- | --- |
| [`agents-md`](agents-md) | Keeps a rolling `docs/AGENTS.md` handoff record of in-progress work and decisions in a repo. |
| [`branch-naming`](branch-naming) | Names new git branches with a conventional prefix plus a short kebab-case summary. |
| [`incremental-commits`](incremental-commits) | Commits work in small, logical, conventional-commit steps instead of one big commit. |
| [`jev-review`](jev-review) | Checks that a diff matches the original request (unrelated changes, missing requirements, security) using TypeSafe's Jev model. |
| [`poll-codex-comments`](poll-codex-comments) | After opening a PR, waits for the Codex automated reviewer's comments and triages them. |
| [`pr-description-writer`](pr-description-writer) | Writes PR descriptions as an overall summary plus a per-file breakdown of changes. |
| [`pre-push-checklist`](pre-push-checklist) | Runs the linter, type checker, tests and a secret scan before `git push`, and blocks the push on failure. |
| [`verify`](verify) | `/verify`: tests freshly written code in an isolated git worktree and checks it does what was asked. |

These skills reflect my own workflow preferences (branch names, commit style, PR format), so read a
`SKILL.md` before adopting it.

### Install skills

Claude Code loads skills from `~/.claude/skills/<skill-name>/SKILL.md`.

**Pick individual skills** (recommended if you already have skills of your own):

```sh
git clone https://github.com/osherboudara99/my-claude-skills.git /tmp/my-claude-skills
cp -R /tmp/my-claude-skills/branch-naming ~/.claude/skills/    # repeat for each skill you want
```

**Take them all** (only if `~/.claude/skills` doesn't exist yet):

```sh
git clone https://github.com/osherboudara99/my-claude-skills.git ~/.claude/skills
```

If you clone the whole repo this way, install mods from the local copy so they run from your
working tree: `claude plugin marketplace add ~/.claude/skills`, then
`claude plugin install token-meter@my-claude-skills`.

New skills are picked up the next time you start Claude Code.

### Requirements

- `jev-review`, `poll-codex-comments` and `pre-push-checklist` call [TypeSafe](https://typesafe.ai)'s Jev model
  and need `TYPESAFE_API_KEY` set in your environment. `jev-review` requires it.
  `pre-push-checklist` and `poll-codex-comments` fall back to running without Jev when it's unset.
- `poll-codex-comments` and `pr-description-writer` use the [GitHub CLI](https://cli.github.com) (`gh`).
- The Jev helper scripts need Python 3.

## Developing

See [`docs/mods.md`](docs/mods.md) for how mods are laid out, built, promoted into `mods/`,
checked and installed.
