---
name: release
description: Releases pi-spark to npm via Release Please. Use when asked to publish a new version or apply a patch/minor/major or explicit-version release.
---

# Release

pi-spark publishes to npm via [Release Please](https://github.com/googleapis/release-please). Pushing to `main` runs `.github/workflows/release.yml`.

The current version lives in `package.json`. Tags are plain `v*` (no component prefix).

## Choose the version

- Releasable `feat`/`fix` commits are already on `main` → Release Please computes the next version. Skip to "Merge the release PR".
- Otherwise (docs/chore-only changes, or to force a specific version) → drive the release with a `Release-As` footer.

## Commit with `Release-As`

Use one commit carrying a `Release-As: x.y.z` footer that sets the next version:

- The commit has real changes → put the footer on that same commit.
- You only need to trigger a release → use an empty commit.

```bash
# alongside real changes
git commit -m "docs: polish README" -m "Release-As: 0.11.3"

# release-only, nothing else to change
git commit --allow-empty -m "chore: release 0.11.3" -m "Release-As: 0.11.3"
```

Then `git push origin main`.

## Merge the release PR

Release Please opens or updates a single PR labeled `autorelease: pending`. If none appears, the run is still going or there are no releasable commits — re-check after the run; don't hand-create it.

```bash
gh pr list --label "autorelease: pending" --state open --json number,title
gh pr view <number> --json files   # expect only the CHANGELOG and package.json bump
gh pr merge <number> --squash
git checkout main && git pull
```

Don't hand-edit the version bump. Merging triggers the workflow again to tag, create the GitHub release, and publish to npm.

## Verify

Watch the publish run triggered by the merge:

```bash
gh run watch "$(gh run list --workflow=release.yml --branch=main --limit=1 --json databaseId -q '.[0].databaseId')"
```

Report the released version and release URL.
