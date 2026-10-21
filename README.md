# JAM: the JOLT Application Market

This is the registry behind [JAM](https://jolt.availabooks.com/jam/): free apps for Excel, Word and PowerPoint, built with [JOLT](https://jolt.availabooks.com/). People install them in JET with a code such as `jam:jolt/data-cleanup`.

Every version is identified by a **fingerprint**, the SHA-256 of its canonical bundle. JET runs a version only if the code it downloads has the fingerprint the user approved. So once a version is published here it can never change, wherever it is served from.

## Layout

```
apps/<owner>/<app>/<version>.json   one entry per published version
blobs/<sha256>.json                 the bundle each entry names: every file of that version
tools/verify.mjs                    the check that runs on every pull request
```

An entry looks like this:

```json
{
  "id": "jolt/data-cleanup",
  "version": "1.0.0",
  "sha256": "…64 hex digits…",
  "repo": "availabooks/jolt-apps",
  "path": "data-cleanup",
  "commit": "…40 hex digits…",
  "publishedAt": "2026-10-21T00:00:00.000Z"
}
```

## Publishing an app

1. Put the app in a **public** GitHub repository, at its root or in a folder.
2. Give its `jolt.json` the publish fields:
   - `id`: `<your GitHub user or organization>/<app>`
   - `name`, `version` and `description`
   - `permissions`: `{ "hosts": [...], "network": [...] }`
   - optionally `funding`, tip links that are also listed in the repo's `.github/FUNDING.yml`

   See [Publish your own app](https://jolt.availabooks.com/jam/#publish-your-own-app).
3. Commit and push. In the app's folder, run:
   ```
   jolt jam release --registry <your clone of this repository>
   ```
   In VS Code, "JUICE: Prepare JAM Release" does the same. It adds the entry and the bundle here.
4. Open a pull request with those two files.

## What the check enforces

- **Append-only.** Existing entries and bundles can't be edited or deleted. The one allowed change is adding `"yanked": true`, which marks a version "don't install" while keeping it visible.
- **Rebuilt from source.** The check clones `repo` at `commit`, which must be a full SHA, not a branch or tag. It bundles `path` and requires the entry's fingerprint and the submitted bundle to match.
- **Ownership.** The namespace (`<owner>` in the id) must be the GitHub owner of the source repository. The pull request must come from that user, or from a public member of that organization. `jolt` is reserved for `availabooks`.
- **Readable, self-contained code.** Minified files are rejected, and so are missing publish fields. Installed apps can't load remote code at all.
- **Tips go to the developer.** Every `funding` link must appear in the source repository's `FUNDING.yml`.

Maintainers review every pull request before merging. A merged version appears on the JAM page, with its AI review page, when jolt.availabooks.com next deploys.

## Yanking a version

Open a pull request that adds `"yanked": true` to the entry. JET then refuses to run that version and offers the latest one that isn't yanked. Yanked versions are never deleted, so their review pages stay available.

`tools/verify.mjs` is generated from the JOLT repository (`scripts/jam/verify.js`). Don't edit it here.
