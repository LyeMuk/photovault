# Contributing

This is currently a single-maintainer project built phase-by-phase against
[docs/CONTEXT.md](docs/CONTEXT.md). The rules below apply to the agent and any human contributor
alike.

## Branching (Git Flow-lite)

| Branch | From → Into | Rules |
|---|---|---|
| `main` | — | Releases only, from `release/*` or `hotfix/*`, tagged `vX.Y.Z` |
| `develop` | — | Default branch; always green; every push redeploys the web demo |
| `feature/p<phase>-<name>` | `develop` → `develop` | e.g. `feature/p2-backup-engine`; short-lived (≤3 days), one concern |
| `fix/…`, `chore/…`, `docs/…`, `test/…`, `ci/…` | `develop` → `develop` | |
| `release/x.y.0` | `develop` → `main` + back-merge | Version bump, changelog, device checklist |
| `hotfix/x.y.z` | `main` → `main` + back-merge | Urgent fixes |

Never commit directly to `main` or `develop`. Squash-merge features; merge-commit releases.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `feat(engine): …`, `fix(drive): …`,
`test(dedup): …`, `docs:`, `chore:`, `ci:`, `refactor:`, `perf:`. Breaking changes use `!` or a
`BREAKING CHANGE:` footer.

## Pull requests

Open a draft PR early (`gh pr create --draft --base develop --fill`), link the issue it closes, keep it
rebased on `develop`, and fill in the PR template (What / Why / How tested / Screenshots / Demo link /
Photo-safety checklist) before marking it ready.

## Photo safety

Any code path that deletes or moves user files needs: unit tests, a fault-injection test, a dry-run
mode, and a log entry. No exceptions — see CONTEXT.md §16.
