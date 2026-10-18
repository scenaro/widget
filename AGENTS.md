# widget — agent notes

Embeddable Scenaro widget (CDN). Staging build served from staging CDN path when deployed.

## Commands

| Action | Command |
|--------|---------|
| Install | `npm ci` / `pnpm install` (see package.json) |
| Dev | see README / package scripts |
| Build | production build script in package.json |

## Branches

Day-to-day on `main`. Promote by pushing `main` → `staging` (deploys staging) or to `production` (deploys prod).
PRs are optional while solo — use them for risky / large changes; otherwise commit on `main` then promote.
Never force-push long-lived branches. Never point agents at production secrets.

## Cursor Cloud

Single-repo environment is enough for most widget work. Link `sdk` as sibling if changing shared client types.
