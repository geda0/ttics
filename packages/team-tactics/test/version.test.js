"use strict";
// P0-5: `update` prints the version delta (from -> to) read from the manifest, plus a
// keyed BREAKING/MIGRATIONS block for any version newly crossed — so behavior changes
// (e.g. empty-phase now fails closed) are surfaced, never discovered by surprise.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), os = require("os"), path = require("path"), cp = require("child_process");

const CLI = path.join(__dirname, "..", "bin", "cli.js");
function run(args, cwd) { return cp.spawnSync("node", [CLI, ...args], { encoding: "utf8", cwd: cwd || os.tmpdir() }); }
function install() { const d = fs.mkdtempSync(path.join(os.tmpdir(), "tdd-version-")); run([d]); return d; }
const MAN = (d) => path.join(d, ".claude", ".team-tactics", "manifest.json");

test("update across a version boundary prints from->to + BREAKING notes", () => {
  const d = install();
  try {
    const m = JSON.parse(fs.readFileSync(MAN(d), "utf8")); m.kitVersion = "0.3.0"; fs.writeFileSync(MAN(d), JSON.stringify(m));
    const out = (() => { const r = run(["update", d], d); return r.stdout + r.stderr; })();
    assert.match(out, /0\.3\.0/, "shows the prior version");
    assert.match(out, /BREAKING|MIGRATION/i, "shows a breaking-changes header");
    assert.match(out, /phase|off|lib\.sh|tdd\.config/i, "names a 0.4 breaking change");
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test("re-running update at the same version prints no BREAKING block", () => {
  const d = install();
  try {
    const r = run(["update", d], d);
    assert.doesNotMatch(r.stdout + r.stderr, /BREAKING/i, "no breaking notes when already current");
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

// --- B2: version single-source-of-truth + publish-readiness ---
const REPO = path.join(__dirname, "..", "..", "..");

test("B2: the four package.json versions are in lockstep (no version drift)", () => {
  const vers = ["package.json", "packages/tics/package.json", "packages/tdd/package.json", "packages/team-tactics/package.json"]
    .map((p) => JSON.parse(fs.readFileSync(path.join(REPO, p), "utf8")).version);
  assert.strictEqual(new Set(vers).size, 1, "root + tics + tdd + team-tactics must share ONE version; got: " + vers.join(", "));
});

test("B2: `tics --version` prints the authoritative kit version, matching the manifest", () => {
  const pkgV = require("../package.json").version;
  const r = run(["--version"]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.stdout.trim(), pkgV, "prints the package version (single source of truth)");
  const d = install();
  try {
    assert.strictEqual(JSON.parse(fs.readFileSync(MAN(d), "utf8")).kitVersion, pkgV, "the install records the SAME version in the manifest");
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

// LIC-6 (drift: the internal pins sat a patch behind the workspace versions). The pins are EXACT,
// so a pin that matches no local workspace version stops npm resolving from the tree — it goes to the
// public registry, where these unpublished packages 404: `npm install` fails, the @ttics/* symlinks are
// never created, and the suite dies with an opaque `Cannot find module '@ttics/tdd'`. Both sides are
// derived (workspaces walked, lockstep version read from the packages) so a NEW internal dep or a NEW
// workspace is covered automatically and a release bump never edits this test.
test("B2: every internal @ttics/* dependency pin names the lockstep version (npm resolves it from the workspace, not the registry)", () => {
  const root = JSON.parse(fs.readFileSync(path.join(REPO, "package.json"), "utf8"));
  const dirs = ["."].concat((root.workspaces || []).flatMap((pat) => (
    pat.endsWith("/*")
      ? fs.readdirSync(path.join(REPO, pat.slice(0, -2))).map((n) => path.posix.join(pat.slice(0, -2), n))
      : [pat]
  ))).filter((d) => fs.existsSync(path.join(REPO, d, "package.json")));

  const lockstep = root.version; // the one version all four packages share (pinned by the test above)
  const pins = dirs.flatMap((d) => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, d, "package.json"), "utf8"));
    return Object.entries(pkg.dependencies || {})
      .filter(([dep]) => dep.startsWith("@ttics/")) // internal only — a real third-party dep is out of scope
      .map(([dep, pin]) => [d, dep, pin]);
  });
  assert.ok(pins.length > 0, "the workspace scan actually found internal @ttics/* deps (guard against a dead walk)");

  const drift = pins
    .filter(([, , pin]) => pin !== lockstep)
    .map(([d, dep, pin]) => `${d}/package.json pins ${dep} at ${pin} but the lockstep version is ${lockstep}`);
  assert.deepStrictEqual(drift, [], "internal @ttics/* deps must pin the lockstep version:\n  " + drift.join("\n  "));
});

test("B2: each package ships its LICENSE in the npm tarball (publish preflight — terms travel)", () => {
  for (const name of ["tics", "tdd", "team-tactics"]) {
    const r = cp.spawnSync("npm", ["pack", "--dry-run", "--json"], { cwd: path.join(REPO, "packages", name), encoding: "utf8" });
    assert.strictEqual(r.status, 0, name + ": npm pack --dry-run failed: " + r.stderr);
    const files = (JSON.parse(r.stdout)[0].files || []).map((f) => f.path);
    assert.ok(files.some((f) => /(^|\/)LICENSE$/.test(f)), name + ": tarball must include LICENSE; got " + files.join(", "));
  }
});
