// Generated from github.com/availabooks/jolt scripts/jam/verify.js by scripts/jam/export.js. Don't edit it here.


// scripts/jam/verify.js
import { execFile } from "node:child_process";
import { mkdtemp, readFile as readFile2, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join as join2, resolve } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

// cli/files.js
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

// src/project/bundle.js
var BUNDLE_FORMAT = "jam-bundle/1";
var MAX_FILE_BYTES = 2 * 1024 * 1024;
var APP_ID = /^[a-z0-9][a-z0-9-]{0,38}\/[a-z0-9][a-z0-9-]{0,63}$/;
var SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
var SHA256 = /^[0-9a-f]{64}$/;
var lf = (text) => text.replace(/\r\n?/g, "\n");
function makeBundle({ id, version, files }) {
  const sorted = {};
  for (const path of Object.keys(files).sort()) sorted[path] = lf(files[path]);
  return { format: BUNDLE_FORMAT, id, version, files: sorted };
}
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = (
      /** @type {Record<string, unknown>} */
      value
    );
    return `{${Object.keys(obj).sort().filter((k) => obj[k] !== void 0).map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function toHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(text) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}
function hashBundle(bundle) {
  return sha256Hex(canonicalJson(makeBundle(bundle)));
}
function publishInfo(files) {
  let config = {};
  try {
    config = JSON.parse(files["jolt.json"] ?? "{}");
  } catch {
  }
  return {
    id: typeof config.id === "string" ? config.id : "",
    name: typeof config.name === "string" ? config.name : "",
    version: typeof config.version === "string" ? config.version : "",
    description: typeof config.description === "string" ? config.description : "",
    funding: Array.isArray(config.funding) ? config.funding.filter((u) => typeof u === "string") : [],
    /** @type {Permissions} */
    permissions: {
      hosts: Array.isArray(config.permissions?.hosts) ? config.permissions.hosts : [],
      network: Array.isArray(config.permissions?.network) ? config.permissions.network : []
    }
  };
}
var HOSTS = /* @__PURE__ */ new Set(["excel", "word", "powerpoint"]);
function lintBundle(files) {
  const problems = [];
  if (files["jolt.json"] === void 0) return ["jolt.json is missing."];
  try {
    JSON.parse(files["jolt.json"]);
  } catch (e) {
    problems.push(`jolt.json is not valid JSON: ${e instanceof Error ? e.message : e}`);
    return problems;
  }
  const info = publishInfo(files);
  if (!APP_ID.test(info.id)) problems.push('jolt.json needs an "id" of the form "owner/app" (your GitHub user or organization, then the app), all lowercase.');
  if (!info.name) problems.push('jolt.json needs a "name".');
  if (!SEMVER.test(info.version)) problems.push('jolt.json needs a "version" such as "1.0.0".');
  if (!info.description) problems.push('jolt.json needs a "description" (one or two sentences).');
  if (!info.permissions.hosts?.length || !info.permissions.hosts.every((h) => HOSTS.has(h)))
    problems.push('jolt.json needs "permissions": { "hosts": [...] } listing excel, word and/or powerpoint.');
  for (const origin of info.permissions.network ?? []) {
    if (!/^https:\/\/[^/]+$/.test(origin)) problems.push(`permissions.network entries must be https origins with no path (got "${origin}").`);
  }
  for (const url of info.funding) if (!/^https:\/\//.test(url)) problems.push(`funding entries must be https:// URLs (got "${url}").`);
  for (const [path, text] of Object.entries(files)) {
    if (new TextEncoder().encode(text).length > MAX_FILE_BYTES) problems.push(`${path} is larger than 2 MB.`);
    if (/\.(m?js|css|html?)$/.test(path) && looksMinified(text)) problems.push(`${path} looks minified. JAM apps must be readable source so they can be reviewed.`);
  }
  return problems;
}
function looksMinified(text) {
  const lines = lf(text).split("\n").filter((l) => l.trim());
  if (!lines.length) return false;
  if (lines.some((l) => l.length > 1e3)) return true;
  return lines.reduce((n, l) => n + l.length, 0) / lines.length > 200;
}

// cli/files.js
var IGNORED_DIRS = /* @__PURE__ */ new Set(["node_modules", "dist", "jade-classic"]);
var IGNORED_FILES = /* @__PURE__ */ new Set(["jsconfig.json", "tsconfig.json", "package.json", "package-lock.json", "AGENTS.md", "CLAUDE.md"]);
var BINARY = /\.(png|jpe?g|gif|webp|ico|bmp|pdf|zip|gz|woff2?|ttf|otf|eot|mp[34]|wav|xlsx?|docx?|pptx?|exe|dll)$/i;
var MAX_FILE_BYTES2 = 2 * 1024 * 1024;
function isProjectFile(relPath) {
  const parts = relPath.split("/");
  if (parts.some((p) => p.startsWith("."))) return false;
  if (parts.length > 1 && IGNORED_DIRS.has(parts[0])) return false;
  if (parts.length === 1 && IGNORED_FILES.has(parts[0])) return false;
  return !BINARY.test(relPath);
}
async function readProject(root) {
  const files = {};
  const walk = async (dir, prefix) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const rel = prefix + entry.name;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (isProjectFile(rel + "/x")) await walk(path, rel + "/");
      } else if (entry.isFile() && isProjectFile(rel)) {
        if ((await stat(path)).size <= MAX_FILE_BYTES2) files[rel] = await readFile(path, "utf8");
      }
    }
  };
  await walk(root, "");
  return files;
}

// scripts/jam/verify.js
var run = promisify(execFile);
var RESERVED = { jolt: "availabooks" };
var MAINTAINERS_FILE = "maintainers.json";
function parseMaintainers(text) {
  try {
    const raw = JSON.parse(text ?? "{}");
    return Object.fromEntries(
      Object.entries(raw).map(([org, logins]) => [org.toLowerCase(), Array.isArray(logins) ? logins.map((l) => String(l).toLowerCase()) : []])
    );
  } catch {
    return {};
  }
}
var ENTRY_PATH = /^apps\/([a-z0-9-]+)\/([a-z0-9-]+)\/([^/]+)\.json$/;
var BLOB_PATH = /^blobs\/([0-9a-f]{64})\.json$/;
var ENTRY_KEYS = /* @__PURE__ */ new Set(["id", "version", "sha256", "repo", "path", "commit", "publishedAt", "yanked"]);
var REVIEW_PATH = /^reviews\/([a-z0-9-]+)\/([a-z0-9-]+)\/([^/]+)\.json$/;
var REVIEW_KEYS = /* @__PURE__ */ new Set(["id", "version", "sha256", "reviewer", "reviewedAt", "notes", "revoked"]);
var REVIEWERS_KEY = "_reviewers";
function checkAppendOnly(changes) {
  const problems = [];
  for (const c of changes) {
    const flag = ENTRY_PATH.test(c.path) ? "yanked" : REVIEW_PATH.test(c.path) ? "revoked" : BLOB_PATH.test(c.path) ? "" : null;
    if (c.status === "A" || flag === null) continue;
    if (c.status === "M" && flag && c.before && c.after) {
      try {
        const before = JSON.parse(c.before);
        const after = JSON.parse(c.after);
        if (!before[flag] && after[flag] === true && canonicalJson({ ...after, [flag]: void 0 }) === canonicalJson({ ...before, [flag]: void 0 })) continue;
      } catch {
      }
    }
    problems.push(
      flag === "revoked" ? `${c.path}: team reviews can't be changed or removed (only "revoked": true may be added).` : `${c.path}: published versions can't be changed or removed (only "yanked": true may be added). Publish a new version instead.`
    );
  }
  return problems;
}
function checkReview(path, raw, entry, author, reviewers) {
  const m = REVIEW_PATH.exec(path);
  if (!m) return [`${path}: team reviews go in reviews/<owner>/<app>/<version>.json.`];
  if (!raw || typeof raw !== "object") return [`${path}: not a JSON object.`];
  const r = (
    /** @type {Record<string, unknown>} */
    raw
  );
  const problems = [];
  for (const k of Object.keys(r)) if (!REVIEW_KEYS.has(k)) problems.push(`${path}: unknown field "${k}".`);
  if (r.id !== `${m[1]}/${m[2]}`) problems.push(`${path}: "id" must be "${m[1]}/${m[2]}".`);
  if (r.version !== m[3]) problems.push(`${path}: "version" must be "${m[3]}".`);
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(r.reviewedAt))) problems.push(`${path}: "reviewedAt" must be a date such as 2026-10-21.`);
  if (r.notes !== void 0 && (typeof r.notes !== "string" || r.notes.length > 500)) problems.push(`${path}: "notes" must be text of at most 500 characters.`);
  if (r.revoked !== void 0) problems.push(`${path}: a new review can't start out revoked.`);
  if (!entry) problems.push(`${path}: there is no published ${m[1]}/${m[2]} ${m[3]} to review.`);
  else if (r.sha256 !== entry.sha256) problems.push(`${path}: "sha256" must be the version's fingerprint, ${entry.sha256}.`);
  if (String(r.reviewer).toLowerCase() !== author.toLowerCase()) problems.push(`${path}: "reviewer" must be the pull request's author, ${author}.`);
  if (!reviewers.includes(author.toLowerCase())) problems.push(`${path}: ${author} isn't a JOLT team reviewer (maintainers.json "${REVIEWERS_KEY}").`);
  return problems;
}
function checkEntry(path, raw) {
  const m = ENTRY_PATH.exec(path);
  if (!m) return [`${path}: entries go in apps/<owner>/<app>/<version>.json.`];
  if (!raw || typeof raw !== "object") return [`${path}: not a JSON object.`];
  const e = (
    /** @type {Record<string, unknown>} */
    raw
  );
  const problems = [];
  for (const k of Object.keys(e)) if (!ENTRY_KEYS.has(k)) problems.push(`${path}: unknown field "${k}".`);
  if (e.id !== `${m[1]}/${m[2]}` || !APP_ID.test(String(e.id))) problems.push(`${path}: "id" must be "${m[1]}/${m[2]}".`);
  if (e.version !== m[3] || !SEMVER.test(String(e.version))) problems.push(`${path}: "version" must be "${m[3]}", a version such as 1.0.0.`);
  if (!SHA256.test(String(e.sha256))) problems.push(`${path}: "sha256" must be 64 lowercase hex digits.`);
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(String(e.repo))) problems.push(`${path}: "repo" must be "owner/repo" on GitHub.`);
  if (typeof e.path !== "string" || e.path.startsWith("/") || e.path.split("/").includes("..")) problems.push(`${path}: "path" must be a folder inside the repo ("." for its root).`);
  if (!/^[0-9a-f]{40}$/.test(String(e.commit))) problems.push(`${path}: "commit" must be a full 40-character commit SHA, not a branch or tag (those can move).`);
  if (e.yanked !== void 0 && e.yanked !== true) problems.push(`${path}: "yanked" may only be true.`);
  return problems;
}
function checkOwnership(entry, author, authorInOrg) {
  const namespace = entry.id.split("/")[0];
  const repoOwner = entry.repo.split("/")[0].toLowerCase();
  const expected = (
    /** @type {Record<string, string>} */
    RESERVED[namespace] ?? namespace
  );
  const problems = [];
  if (repoOwner !== expected) problems.push(`${entry.id}: apps in the "${namespace}" namespace must come from a repository owned by ${expected} (got ${entry.repo}).`);
  if (author.toLowerCase() !== expected && !authorInOrg) problems.push(`${entry.id}: only ${expected}, its public members, or people listed for it in maintainers.json can publish in "${namespace}". The pull request is from ${author}.`);
  return problems;
}
function checkFunding(funding, fundingYml) {
  if (!funding.length) return [];
  if (fundingYml === null) return ["jolt.json lists funding links, but the source repository has no .github/FUNDING.yml to confirm them."];
  const allowed = fundingUrls(fundingYml);
  return funding.filter((u) => !allowed.has(normalizeUrl(u))).map((u) => `Funding link ${u} is not listed in the source repository's FUNDING.yml.`);
}
var normalizeUrl = (url) => url.trim().replace(/\/+$/, "").toLowerCase();
var FUNDING_PLATFORMS = (
  /** @type {Record<string, (name: string) => string>} */
  {
    github: (n) => `https://github.com/sponsors/${n}`,
    ko_fi: (n) => `https://ko-fi.com/${n}`,
    buy_me_a_coffee: (n) => `https://buymeacoffee.com/${n}`,
    liberapay: (n) => `https://liberapay.com/${n}`,
    patreon: (n) => `https://patreon.com/${n}`,
    open_collective: (n) => `https://opencollective.com/${n}`,
    polar: (n) => `https://polar.sh/${n}`,
    thanks_dev: (n) => `https://thanks.dev/${n}`,
    custom: (n) => n
  }
);
function fundingUrls(yml) {
  const urls = /* @__PURE__ */ new Set();
  let key = "";
  for (const raw of yml.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "");
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line.trim());
    let values = [];
    if (kv && !raw.startsWith(" ") && !raw.startsWith("-")) {
      key = kv[1];
      values = kv[2].replace(/^\[|\]$/g, "").split(",");
    } else if (/^\s*-\s+/.test(line)) values = [line.replace(/^\s*-\s+/, "")];
    for (const v of values) {
      const name = v.trim().replace(/^["']|["']$/g, "");
      if (name && FUNDING_PLATFORMS[key]) {
        const url = FUNDING_PLATFORMS[key](name);
        urls.add(normalizeUrl(url));
        urls.add(normalizeUrl(url.replace("https://", "https://www.")));
      }
    }
  }
  return urls;
}
async function checkRebuild(entry, sourceFiles, blobText) {
  const problems = lintBundle(sourceFiles).map((p) => `${entry.id} ${entry.version}: ${p}`);
  const info = publishInfo(sourceFiles);
  if (info.id !== entry.id) problems.push(`${entry.id}: jolt.json at that commit has "id": "${info.id}".`);
  if (info.version !== entry.version) problems.push(`${entry.id}: jolt.json at that commit has "version": "${info.version}", not ${entry.version}.`);
  const bundle = makeBundle({ id: entry.id, version: entry.version, files: sourceFiles });
  const sha = await hashBundle(bundle);
  if (sha !== entry.sha256) problems.push(`${entry.id} ${entry.version}: rebuilding ${entry.repo}@${entry.commit.slice(0, 7)}/${entry.path} gives ${sha}, not the entry's ${entry.sha256}.`);
  if (blobText === null) problems.push(`${entry.id} ${entry.version}: add blobs/${entry.sha256}.json (jolt jam release writes it to .jolt/jam/).`);
  else if (blobText !== canonicalJson(bundle)) problems.push(`blobs/${entry.sha256}.json is not the canonical bundle rebuilt from source.`);
  return problems;
}
var arg = (args, name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : void 0;
};
async function main(argv) {
  const registry = resolve(arg(argv, "registry") ?? ".");
  const base = arg(argv, "base") ?? "origin/main";
  const author = arg(argv, "author") ?? process.env.PR_AUTHOR ?? "";
  const git = async (...a) => (await run("git", a, { cwd: registry, maxBuffer: 64 * 1024 * 1024 })).stdout;
  const show = (rev, path) => git("show", `${rev}:${path}`).catch(() => void 0);
  const mergeBase = (await git("merge-base", base, "HEAD")).trim();
  const maintainers = parseMaintainers(await show(mergeBase, MAINTAINERS_FILE));
  const inOrg = async (org) => (maintainers[org.toLowerCase()] ?? []).includes(author.toLowerCase()) || await isPublicMember(org, author);
  const changes = await Promise.all(
    (await git("diff", "--name-status", "--no-renames", mergeBase, "HEAD")).split("\n").filter(Boolean).map(async (line) => {
      const [status, path] = line.split("	");
      return { status: status[0], path, before: await show(mergeBase, path), after: await show("HEAD", path) };
    })
  );
  const problems = checkAppendOnly(changes);
  const added = changes.filter((c) => c.status === "A" && ENTRY_PATH.test(c.path));
  for (const c of added) {
    let entry;
    try {
      entry = JSON.parse(c.after ?? "");
    } catch {
      problems.push(`${c.path}: not valid JSON.`);
      continue;
    }
    const shape = checkEntry(c.path, entry);
    problems.push(...shape);
    if (shape.length) continue;
    const owner = (
      /** @type {Record<string, string>} */
      RESERVED[entry.id.split("/")[0]] ?? entry.id.split("/")[0]
    );
    problems.push(...checkOwnership(entry, author, author.toLowerCase() !== owner && await inOrg(owner)));
    const checkout = await mkdtemp(join2(tmpdir(), "jam-"));
    try {
      await run("git", ["clone", "--quiet", "--filter=blob:none", "--no-checkout", `https://github.com/${entry.repo}.git`, checkout]);
      await run("git", ["checkout", "--quiet", entry.commit], { cwd: checkout });
      const files = await readProject(join2(checkout, entry.path));
      problems.push(...await checkRebuild(entry, files, await readFile2(join2(registry, "blobs", `${entry.sha256}.json`), "utf8").catch(() => null)));
      const fundingYml = await readFile2(join2(checkout, ".github", "FUNDING.yml"), "utf8").catch(() => readFile2(join2(checkout, "FUNDING.yml"), "utf8").catch(() => null));
      problems.push(...checkFunding(publishInfo(files).funding, fundingYml));
    } catch (e) {
      problems.push(`${entry.id} ${entry.version}: could not check out ${entry.repo}@${entry.commit}: ${e instanceof Error ? e.message : e}`);
    } finally {
      await rm(checkout, { recursive: true, force: true });
    }
  }
  const reviewers = maintainers[REVIEWERS_KEY.toLowerCase()] ?? [];
  const reviews = changes.filter((c) => c.status === "A" && REVIEW_PATH.test(c.path));
  for (const c of reviews) {
    let review;
    try {
      review = JSON.parse(c.after ?? "");
    } catch {
      problems.push(`${c.path}: not valid JSON.`);
      continue;
    }
    const entryText = await show("HEAD", c.path.replace(/^reviews\//, "apps/"));
    let entry = null;
    try {
      entry = entryText ? JSON.parse(entryText) : null;
    } catch {
    }
    problems.push(...checkReview(c.path, review, entry, author, reviewers));
  }
  for (const c of changes.filter((x) => x.status === "A" && BLOB_PATH.test(x.path))) {
    const sha = (
      /** @type {RegExpExecArray} */
      BLOB_PATH.exec(c.path)[1]
    );
    try {
      if (await hashBundle(JSON.parse(c.after ?? "")) !== sha) problems.push(`${c.path}: its contents don't hash to its name.`);
    } catch {
      problems.push(`${c.path}: not a valid bundle.`);
    }
  }
  if (problems.length) {
    console.error(`JAM registry check failed:
- ${problems.join("\n- ")}`);
    return 1;
  }
  console.log(`JAM registry check passed (${added.length} new version${added.length === 1 ? "" : "s"}, ${reviews.length} team review${reviews.length === 1 ? "" : "s"}).`);
  return 0;
}
async function isPublicMember(org, user) {
  if (!user) return false;
  const headers = (
    /** @type {Record<string, string>} */
    { accept: "application/vnd.github+json", "user-agent": "jam-verify" }
  );
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/orgs/${org}/public_members/${user}`, { headers });
  return res.status === 204;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main(process.argv.slice(2)).then((code) => process.exit(code));
export {
  MAINTAINERS_FILE,
  RESERVED,
  REVIEWERS_KEY,
  checkAppendOnly,
  checkEntry,
  checkFunding,
  checkOwnership,
  checkRebuild,
  checkReview,
  fundingUrls,
  main,
  parseMaintainers
};
