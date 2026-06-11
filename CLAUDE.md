# Watthog — Agent Instructions

## Conventional Commits

This repo uses **Conventional Commits** — every commit message must follow the format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Release | Use for |
|---|---|---|
| `fix` | patch (0.0.x) | Bug fixes |
| `feat` | minor (0.x.0) | New features |
| `BREAKING CHANGE` | major (x.0.0) | Breaking API changes |
| `docs` | — | Documentation only |
| `style` | — | Formatting, whitespace |
| `refactor` | — | Code restructuring |
| `perf` | — | Performance improvements |
| `test` | — | Adding tests |
| `build` | — | Build system, deps |
| `ci` | — | CI/CD changes |
| `chore` | — | Maintenance |
| `revert` | — | Reverting changes |

### Scopes (optional)

- `cli` — command-line interface
- `sources` — log parsers (Claude Code, OpenCode, Cursor, Codex CLI)
- `energy` — energy/compute engine
- `report` — output formatting, terminal UI
- `web` — watthog.ai website

### Examples

```
feat(cli): add --json flag for machine-readable output
fix(sources): handle missing .codex directory gracefully
docs: clarify water factor source in methodology
BREAKING CHANGE: rename --co2 flag to --grid-intensity
```

### Why

Commit messages drive **automated versioning and changelogs**. The release
pipeline (`semantic-release`) reads every commit since the last tag to
determine the next version and generate `CHANGELOG.md`.

---

## Development workflow

```
Feature branch  ──→  PR to main  ──→  Merge  ──→  Auto-release
                                                        ↓
                                          npm publish + GitHub Release
```

1. Create a branch from `main`
2. Make changes with conventional commits
3. Open a PR — CI validates commits and code
4. PR must be approved by @boomboxbacardi
5. Merge to `main` — `semantic-release` creates a new version and publishes
   to npm automatically

### Branch protection (main)

- Direct pushes are blocked
- PRs require 1 approval (code owner)
- Status checks must pass (commitlint + syntax checks)
- PRs must be up to date with main

---

## Release automation (`semantic-release`)

Triggered automatically on push to `main`.

| Trigger | What happens |
|---|---|
| `fix:` commit | Patch release (0.1.0 → 0.1.1) |
| `feat:` commit | Minor release (0.1.0 → 0.2.0) |
| `BREAKING CHANGE` | Major release (0.1.0 → 1.0.0) |
| No relevant commits | Nothing (skipped) |

Per release:

1. Version calculated from commits since last tag
2. `CHANGELOG.md` written
3. Git tag pushed
4. GitHub Release created
5. Package published to npm

Environment variables needed in GitHub Secrets:

| Secret | Source |
|---|---|
| `NPM_TOKEN` | npmjs.com → Access Tokens → Automation token |
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions (no setup needed) |

---

## NPM package

- **Package name:** `watthog`
- **Registry:** public npm, published via CI
- **Entry point:** `src/cli.js` (shebang + ESM)
- **Minimum Node.js:** 20
- **Publishing is fully automated** — never run `npm publish` manually

---

## Project structure

```
watthog/
├── src/
│   ├── cli.js          # Entry point, arg parsing
│   ├── energy.js       # Energy calculation engine
│   ├── report.js       # Terminal output formatting
│   └── sources/        # Log parsers per agent
├── web/                # watthog.ai website (Next.js)
├── .github/
│   └── workflows/
│       └── pr-checks.yml   # CI for PRs
├── .husky/
│   └── commit-msg     # Local commit validation
├── .commitlintrc.json
├── CLAUDE.md           # This file
├── LICENSE             # MIT
└── README.md
```

---

## Design philosophy

- All numbers ship with a **low–high range**, never a single point estimate
- The **equivalence engine** auto-picks real-world comparisons (toast, phone
  charges, dishwasher runs) so numbers feel physical
- The **hog mascot** carries the brand — Tamagotchi energy, Duolingo
  confidence. The data is rigorous, the wrapper is huggable
- **Privacy by design** — reads local logs only, no data leaves the machine
  unless the user explicitly opts into the leaderboard
