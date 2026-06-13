---
name: release
description: Releases a new version of pi-credits via Release Please. Use when asked to release, publish a new version, or to release a specific version (e.g., 0.10.1) or bump type (patch, minor, major). Drives the Release Please GitHub Action, optionally records a Release-As override commit, then merges and pulls the auto-generated release PR.
---

# Release

This repo releases through [Release Please](https://github.com/googleapis/release-please). The workflow `.github/workflows/release.yml` runs on every push to `main`. It:

1. Parses conventional commits since the last release.
2. Opens/maintains a **release PR** that bumps `package.json` and updates `CHANGELOG.md`.
3. On merge of that PR, tags the release, creates the GitHub release, and the `publish` job runs `npm publish`.

## Decide the version

Determine what the user asked for:

- **No version and no type given** → release the **default** version that Release Please already computed from the conventional commits. Skip to [Merge and pull the release PR](#merge-and-pull-the-release-pr).
- **Explicit version given** (e.g. `0.10.1`) → use it verbatim as the target version.
- **Bump type given** (`patch`, `minor`, `major`) → compute the target version from the current `package.json` version.

When a version or type is given, continue to [Record the Release-As override](#record-the-release-as-override). Confirm the computed target version with the user before pushing if there is any ambiguity.

## Record the `Release-As` override

Only for an explicit version or bump type. Push a commit whose body carries `Release-As:`. Release Please then opens/updates the release PR for exactly that version.

```bash
git commit -m "..." -m "Release-As: X.Y.Z"
git push
```

Then wait for the Release workflow to update the release PR.

## Merge and pull the release PR

Find the open release PR (Release Please labels it `autorelease: pending`):

```bash
gh pr list --label "autorelease: pending" --state open --json number,title,headRefName
```

If none is open, Release Please has not produced one yet — there are likely no releasable commits, or the workflow from a `Release-As` push is still running. Re-check after the run finishes; do not hand-create the PR.

Verify the PR's target version matches the intended release, then **squash merge** it and update local `main`:

```bash
gh pr merge <number> --squash
git checkout main && git pull
```

Merging triggers the workflow again to tag, create the GitHub release, and publish to npm automatically. Optionally watch it:

```bash
gh run watch "$(gh run list --workflow=release.yml --branch=main --limit=1 --json databaseId -q '.[0].databaseId')"
```

Report the released version and the release URL (`gh release view --web` or the run summary) when done.
