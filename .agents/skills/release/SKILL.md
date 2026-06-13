---
name: release
description: Releases pi packages to npm via Release Please. Use when asked to publish a new version or apply a patch/minor/major or explicit-version release.
---

# Release

This monorepo publishes to npm via [Release Please](https://github.com/googleapis/release-please) (manifest mode). Pushing to `main` runs `.github/workflows/release.yml`.

Package paths, components, tag format, and current versions live in `release-please-config.json` and `.release-please-manifest.json`.

## Choose the version

- Releasable `feat`/`fix` commits are already on `main` → Release Please computes the next version. Skip to "Merge the release PR".
- Otherwise (docs/chore-only changes, or to force a specific version) → drive the release with a `Release-As` footer.

## Commit with `Release-As`

Use one commit per package being released, each carrying a `Release-As: x.y.z` footer that sets that package's next version:

- The commit has real changes for the package → put the footer on that same commit (scoped to the package path).
- You only need to trigger a release → use an empty commit, scoped to the package.

```bash
# alongside real changes
git commit -m "docs(pi-spark): polish README" -m "Release-As: 0.11.1" -- packages/pi-spark

# release-only, nothing else to change
git commit --allow-empty -m "chore(pi-credits): release 0.4.1" -m "Release-As: 0.4.1"
```

Commit shared or CI changes separately, without a footer. Then `git push origin main`.

## Merge the release PR

Release Please opens or updates a single PR labeled `autorelease: pending`. If none appears, the run is still going or there are no releasable commits — re-check after the run; don't hand-create it.

```bash
gh pr list --label "autorelease: pending" --state open --json number,title
gh pr view <number> --json files   # expect only the manifest, CHANGELOGs, and package.json bumps
gh pr merge <number> --squash
git checkout main && git pull
```

Don't hand-edit the version bumps. Merging triggers the workflow again to tag, create GitHub releases, and publish to npm.

## Verify

Watch the publish run triggered by the merge:

```bash
gh run watch "$(gh run list --workflow=release.yml --branch=main --limit=1 --json databaseId -q '.[0].databaseId')"
```

Report the released versions and release URLs.
