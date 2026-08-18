"use strict";
// Peer distribution: `npm run pack:tarball` builds a self-contained, sendable tarball (no
// registry / no npm install needed — the kit has zero external deps), and FOR-TESTERS.md ships
// in it to guide a tester through install + what to try. The tarball is still the channel
// (nothing is published to npm), but since ADR 0025 the kit it carries is open source under MIT
// — so the doc must state the terms it actually ships under, and must not keep telling readers
// the software is proprietary/confidential or that they may not redistribute it: MIT expressly
// grants redistribution, so that sentence would misstate the LICENSE travelling beside it.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), os = require("os"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, "..", "..", "..");        // test -> team-tactics -> packages -> repo root

test("FOR-TESTERS.md guides a peer to install, says what to try, and states the MIT terms the kit actually ships under", () => {
  const f = path.join(ROOT, "FOR-TESTERS.md");
  assert.ok(fs.existsSync(f), "a FOR-TESTERS.md at the repo root");
  const t = fs.readFileSync(f, "utf8");
  assert.match(t, /tar -xzf[\s\S]*bin\/cli\.js init/, "shows the extract-and-run install");
  assert.match(t, /selftest/, "shows how to verify the install");
  // One proximity pin on the CLAIM, not two bare mentions: "this is not MIT; see LICENSE for the
  // proprietary terms" would satisfy /\bMIT\b/ + /LICENSE/ while saying the opposite. The doc must
  // state the terms it ships under — licensed UNDER MIT, pointing at LICENSE — however it words it.
  assert.match(t.replace(/\s+/g, " "), /\bunder\b[^.]{0,20}\bMIT\b[^.]{0,80}LICENSE/i,
    "states the terms it ships under: licensed under MIT, pointing at the LICENSE file that carries them");
  assert.doesNotMatch(t, /proprietary|confidential|do not redistribute/i,
    "no leftover private-evaluation terms — under MIT redistribution is expressly granted, so this doc must not deny it");
  assert.match(t, /feedback|geda071@gmail\.com/i, "tells them how to send feedback");
});

test("`npm run pack:tarball` builds a self-contained tarball of the released kit", () => {
  assert.ok(require(path.join(ROOT, "package.json")).scripts["pack:tarball"], "root package.json wires pack:tarball");
  const out = path.join(os.tmpdir(), "ttics-pack-test-" + process.pid + ".tgz");
  try {
    const r = cp.spawnSync("node", [path.join(ROOT, "scripts", "pack-tarball.js"), out], { cwd: ROOT, encoding: "utf8" });
    assert.strictEqual(r.status, 0, "pack script runs clean: " + r.stderr);
    assert.ok(fs.existsSync(out), "a tarball is produced at the requested path");
    const buf = fs.readFileSync(out);
    assert.ok(buf.length > 1000, "non-trivial size");
    assert.strictEqual(buf[0], 0x1f, "gzip magic byte 1");
    assert.strictEqual(buf[1], 0x8b, "gzip magic byte 2");
    const list = cp.execFileSync("tar", ["-tzf", out], { encoding: "utf8" });
    for (const f of ["FOR-TESTERS.md", "LICENSE", "packages/team-tactics/bin/cli.js"])
      assert.ok(list.split("\n").includes(f), "tarball ships " + f);
  } finally { try { fs.rmSync(out); } catch (e) {} }
});

test("infra/release-tarball.sh exists and release:tarball is wired", () => {
  const sh = path.join(ROOT, "infra", "release-tarball.sh");
  assert.ok(fs.existsSync(sh), "infra/release-tarball.sh for CI + dev-ops");
  assert.ok(require(path.join(ROOT, "package.json")).scripts["release:tarball"], "npm run release:tarball");
  assert.ok(fs.existsSync(path.join(ROOT, ".github", "workflows", "release-tarball.yml")), "CI workflow on v* tags");
});

// H1a (design-notes § H1): the sendable tarball is built from the committed tree via `git archive`,
// so slimming it = (1) the dev-cruft fossils stop being tracked and (2) a `.gitattributes` declares
// `export-ignore` for the non-shipping areas. Both are SOURCE-LEVEL facts that go green BEFORE commit
// (asserting the archive output would deadlock the pre-commit gate, since the tarball reflects the
// COMMITTED tree). Today: 94 fossil files are tracked and there is no `.gitattributes` — so this is RED.
test("H1a: the release artifact excludes dev cruft — fossils untracked + .gitattributes export-ignore covers them", () => {
  const tracked = cp.execFileSync("git", ["-C", ROOT, "ls-files", "claim-session", "claim-owner"], { encoding: "utf8" }).trim();
  assert.strictEqual(tracked, "", "the fossil dirs claim-session/ + claim-owner/ are no longer tracked");

  const ga = path.join(ROOT, ".gitattributes");
  assert.ok(fs.existsSync(ga), "a .gitattributes exists at the repo root");
  const t = fs.readFileSync(ga, "utf8");
  assert.match(t, /export-ignore/, "declares export-ignore for git archive");
  assert.match(t, /test\b|tests?\/|\*\*\/test/, "excludes test dirs from the artifact");
  assert.match(t, /\.claude/, "excludes the repo's own .claude dogfood tree");
  assert.match(t, /docs\/decisions/, "excludes docs/decisions ADRs");
  assert.match(t, /infra/, "excludes infra/");
  assert.match(t, /claim-session/, "export-ignores the claim-session fossil");
  assert.match(t, /claim-owner/, "export-ignores the claim-owner fossil");
});

test("release-tarball.sh rejects a pushed tag that does not match package.json (clear error)", () => {
  const sh = path.join(ROOT, "infra", "release-tarball.sh");
  const r = cp.spawnSync("bash", [sh], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, REQUIRE_TAG: "1", TAG_NAME: "v9.9.9" },
  });
  assert.notStrictEqual(r.status, 0);
  const out = (r.stdout || "") + (r.stderr || "");
  assert.match(out, /pushed tag v9\.9\.9 but package\.json version is/, "names both sides of the mismatch");
  assert.match(out, /bump all four package\.json/, "tells the operator how to fix it");
});

// W11 (ADR 0024 § 9, drift D-0024-stray-artifact): a tool-call artifact leaked into a shipped doc
// (`kit/docs/tool-support.md`, commit 4930883 / v0.61.0) and reached every adopter. Sweep the whole
// shipped kit markdown — walked, not hardcoded, so a NEW file can't slip a fifth occurrence through.
test("W11: no markdown the kit ships to adopters carries a stray tool-call artifact", () => {
  const ARTIFACTS = ["invoke", "content"].map((tag) => `</${tag}>`); // closing tool-call tags, never legitimate prose
  const mdUnder = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? mdUnder(p) : e.name.endsWith(".md") ? [p] : [];
  });

  const pkgs = path.join(ROOT, "packages");
  const kits = fs.readdirSync(pkgs).map((n) => path.join(pkgs, n, "kit")).filter((d) => fs.existsSync(d));
  const shipped = kits.flatMap(mdUnder); // includes the full-team preset docs under team-tactics/kit/presets/
  assert.ok(shipped.length > 5, "the sweep actually found the shipped kit markdown (guard against a dead walk)");

  const offenders = shipped
    .map((f) => [path.relative(ROOT, f), fs.readFileSync(f, "utf8")])
    .map(([rel, text]) => [rel, ARTIFACTS.filter((a) => text.includes(a))])
    .filter(([, hits]) => hits.length)
    .map(([rel, hits]) => `${rel} contains ${hits.join(" + ")}`);

  assert.deepStrictEqual(offenders, [], "shipped .md must not contain tool-call artifacts:\n  " + offenders.join("\n  "));
});

// PORT-1 (ADR 0025 — the repo is now open source and PUBLISHED): a machine-specific absolute path in
// a tracked file is two bugs at once — a PRIVACY leak (it publishes a home directory and a person's
// real name to every reader) and a CORRECTNESS bug (it documents a location that exists on exactly
// one machine, so no reader can follow it). Enumerate from `git ls-files`, never a hardcoded list,
// so a NEW file cannot slip a new leak through. NOT violations: `~/…` (a tilde path is portable by
// construction — FOR-TESTERS.md and scripts/pack-tarball.js legitimately use `~/ttics-kit`), and the
// handle `geda0` / geda071@gmail.com (the project's deliberate public identity and the MIT copyright
// holder, required by license.test.js).
test("PORT-1: no file tracked in git carries a machine-specific absolute path or the maintainer's personal name", () => {
  const LEAKS = [
    ["macOS home path", /\/Users\/[A-Za-z0-9._-]+\//],
    ["Linux home path", /\/home\/[A-Za-z0-9._-]+\//],
    ["Windows user path", /[A-Za-z]:\\Users\\[A-Za-z0-9._-]+/],
    ["maintainer's personal name", /marwan|elgendy/i],
  ];
  // This file necessarily CONTAINS the patterns it hunts for (they are written just above as regex
  // literals), so the sweep would flag its own source. Excluded by path — honestly, and only this one
  // file; weakening the patterns to dodge the self-match would weaken the sweep for every other file.
  const SELF = path.relative(ROOT, __filename);

  const tracked = cp.execFileSync("git", ["-C", ROOT, "ls-files", "-z"], { encoding: "utf8" })
    .split("\0").filter(Boolean).filter((rel) => rel !== SELF);
  assert.ok(tracked.length > 20, "the sweep actually enumerated the tracked files (guard against a dead walk)");

  const offenders = [];
  for (const rel of tracked) {
    let buf;
    try { buf = fs.readFileSync(path.join(ROOT, rel)); } catch (e) { continue; } // staged-but-absent, dir symlink
    if (buf.includes(0)) continue;                                               // binary asset — no text to sweep
    buf.toString("utf8").split("\n").forEach((line, i) => {
      const hits = LEAKS.filter(([, re]) => re.test(line)).map(([what]) => what);
      if (hits.length) offenders.push(`${rel}:${i + 1} [${hits.join(" + ")}] ${line.trim().slice(0, 120)}`);
    });
  }

  assert.deepStrictEqual(offenders, [],
    "tracked files must be portable — no home-directory absolute path, no maintainer name:\n  " + offenders.join("\n  "));
});

test("the release git-archive tarball SHIPS the full-team preset helper (a bare scripts/ export-ignore strips it)", () => {
  // The real artifact is `git archive` filtered by .gitattributes. A bare `scripts/ export-ignore`
  // matches the nested preset scripts/ dir and strips the browser-QA helper, crashing the installer
  // (v0.66.0 bug). Assert the ACTUAL archive output. Archive a WORKING-tree-reflecting tree via
  // `git stash create` (|| HEAD) so an in-progress fix is seen and the pre-commit gate never deadlocks.
  const stash = cp.execFileSync("git", ["-C", ROOT, "stash", "create"], { encoding: "utf8" }).trim();
  const tree = stash || "HEAD";
  const out = path.join(os.tmpdir(), "ttics-helper-pack-" + process.pid + ".tgz");
  try {
    cp.execFileSync("git", ["-C", ROOT, "archive", "--format=tar.gz", "-o", out, tree]);
    const list = cp.execFileSync("tar", ["-tzf", out], { encoding: "utf8" }).split("\n");
    assert.ok(
      list.includes("packages/team-tactics/kit/presets/full-team/scripts/smoke-verify.cjs"),
      "the browser-QA helper must ship in the release tarball — root-anchor the dev `scripts/` export-ignore as `/scripts/`"
    );
  } finally { try { fs.rmSync(out); } catch (e) {} }
});
