# Developing mods

A **mod** is a Claude Code plugin with a hooks module: code that changes Claude Code's own
interface or behaviour (a band above the prompt, a pane, a slash command, a hook on tool calls).
Mods live in `mods/` and this repo doubles as a plugin **marketplace** that lists them.

## How it fits together

```
~/.claude/skills/                    ← this git repo (skills + mods)
├── .claude-plugin/marketplace.json  ← the marketplace: which mods this repo offers
├── <skill>/SKILL.md                 ← skills, loaded automatically from this folder
└── mods/<mod-name>/                 ← each mod's source

~/.claude/plugins/                   ← Claude Code's own record (not in git, don't edit)
└── installed_plugins.json           ← which mods are installed, and where they're read from
```

The marketplace was added from this local folder (`claude plugin marketplace add ~/.claude/skills`),
so an installed mod runs **straight from `mods/<mod-name>/`**, not from a copy. Edit the files,
run `/reload-plugins` (or start a new session), and the change is live. No reinstall or version bump.

> Mods go in `mods/`, never directly in the repo root. Claude Code also auto-loads any
> `~/.claude/skills/<name>/` folder holding a `.claude-plugin/plugin.json`, so a mod at the root
> would load twice: once from there and once as an installed plugin.

## Anatomy of a mod

```
mods/<mod-name>/
├── .claude-plugin/plugin.json   ← name, version, description, author, "types"
├── hooks/hooks.json             ← { "modules": ["./register.tsx"] }
├── hooks/register.tsx           ← export const register: Register = (on) => { ... }
├── types/index.d.ts             ← contract for any $.state values (no imports allowed)
└── tests/*.test.tsx             ← run with `claude plugin test`
```

Claude Code generates `.claude-plugin/types/` and `tsconfig.json` inside each mod on load (editor
types). They're gitignored, so don't commit them.

## Creating a new mod

Ask Claude to build it with the `plugin-authoring` skill. There are two ways to go:

### A. Straight into the repo (for mods you know you'll keep)

Tell Claude to build it in `mods/<mod-name>/` and install it. Claude then:

1. Writes the mod in `~/.claude/skills/mods/<mod-name>/`.
2. Adds an entry to `.claude-plugin/marketplace.json` (see below).
3. Installs it: `claude plugin install <mod-name>@my-claude-skills`.

After each change, run `/reload-plugins`.

### B. In the session workspace first (for throwaway experiments)

By default the skill writes to a per-session folder,
`~/.claude/dev-mods/<session-id>/<mod-name>/`, which hot-reloads at the end of every turn once you
answer **Turn them on**. That folder belongs to one session and is not in git. To keep the mod,
**promote** it:

1. **Move** it to `~/.claude/skills/mods/<mod-name>/`, skipping the regenerated files:
   ```sh
   rsync -a --exclude '.claude-plugin/types/' --exclude '/tsconfig.json' \
     ~/.claude/dev-mods/<session-id>/<mod-name>/ ~/.claude/skills/mods/<mod-name>/
   ```
2. **Add an entry** for it in `~/.claude/skills/.claude-plugin/marketplace.json`.
3. **Install** it: `claude plugin install <mod-name>@my-claude-skills`.
4. **Delete** the `dev-mods` copy so it doesn't load twice:
   `rm -rf ~/.claude/dev-mods/<session-id>/<mod-name>`.

## Marketplace entry

Add one object per mod to `plugins` in `.claude-plugin/marketplace.json`:

```json
{
  "name": "<mod-name>",
  "source": "./mods/<mod-name>",
  "description": "<one line, same as plugin.json>"
}
```

`name` must match `name` in the mod's `plugin.json`.

## Checking a mod

Run from the repo root:

```sh
claude plugin validate .                    # the marketplace and every mod it lists
claude plugin validate mods/<mod-name>      # one mod: manifest, hooks, state contract
claude plugin test mods/<mod-name>          # the mod's *.test.tsx files
claude plugin list                          # installed? enabled? "Read from:" path
```

Quick smoke test without opening a session: `claude -p "/<command>"`. A slash command the mod
answers itself returns its text with no model call.

## Before pushing

This repo is **public**: anyone can read every mod's code. Before pushing a new or changed mod:

- Scan it for secrets (ask Claude to run the plugin-authoring secret scan on the mod folder).
- Make sure it holds no keys, internal URLs or other people's data.
- Run the validate and test commands above.

## Removing a mod

```sh
claude plugin uninstall <mod-name>@my-claude-skills
```

Then delete `mods/<mod-name>/` and its entry in `marketplace.json`.

## Setting up on a new machine

```sh
git clone https://github.com/osherboudara99/my-claude-skills.git ~/.claude/skills
claude plugin marketplace add ~/.claude/skills
claude plugin install token-meter@my-claude-skills    # repeat for each mod
```

Adding the local folder (not the GitHub repo) as the marketplace keeps mods running from the
working copy, so edits apply after `/reload-plugins`.
