# Release checklist

Not yet applicable — no release has been cut. Filled in before the first `release/0.0.0` branch, per
CONTEXT.md §17.2 and §17.4.

Planned checklist (from CONTEXT.md):
- [ ] All CI green (`ci.yml`) on the release branch
- [ ] Real-device matrix re-run for any Phase 3+ changes touching drive/photo I/O
- [ ] `ios-preview.yml` TestFlight build installs and smoke-tests on a real device
- [ ] Apple Developer signing credentials valid and not expiring within 30 days
- [ ] `docs/DEMOS.md` updated with the new demo link / TestFlight build number / video
- [ ] `CHANGELOG.md` generated from Conventional Commits since the last tag
- [ ] Tag `vX.Y.Z` on `main`, back-merge to `develop`
