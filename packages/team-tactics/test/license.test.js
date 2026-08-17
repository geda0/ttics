"use strict";
// ttics is open source under MIT — a deliberate, effectively one-way decision (see
// docs/decisions/0025-open-source-under-mit.md): once the grant is published it cannot be recalled
// from copies already out. These tests exist so the licensing never drifts in EITHER direction by
// accident, and never drifts PER SITE: the declared license must read MIT at every place it is
// declared or displayed — the four package.json SPDX ids, the four LICENSE files npm puts in each
// tarball (so the terms travel with the package), the lockfile scanners read, and the READMEs
// readers read — and no site may creep back to proprietary.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..", "..");        // test -> team-tactics -> packages -> repo root
const PKGS = ["tics", "tdd", "team-tactics"];
// The load-bearing sentences of MIT — the grant, its one condition, the disclaimer. Matched on
// whitespace-normalized text: the terms are pinned, the line wrapping is not.
const MIT_TERMS = [
  [/MIT License/i, "identify itself as the MIT License"],
  [/Copyright \(c\) 2026(\s*[-–]\s*\d{4})? geda0/i, "carry the copyright line (holder + year, range allowed) that MIT attribution hangs on"],
  [/Permission is hereby granted, free of charge, to any person obtaining a copy/i, "grant permission to any recipient, free of charge"],
  [/use, copy, modify, merge, publish, distribute, sublicense, and\/or sell/i, "grant the full set of MIT rights"],
  [/above copyright notice and this permission notice shall be included in all copies/i, "keep attribution as the one condition on those rights"],
  [/THE SOFTWARE IS PROVIDED ["“”]AS IS["“”], WITHOUT WARRANTY OF ANY KIND/i, "disclaim warranties (AS IS) so publishing carries no liability"],
];
// Checked against the WHOLE LICENSE: none of these has a benign use anywhere in one. ("All rights
// reserved" is NOT here — it is benign in a copyright line and in any vendored BSD notice, so it is
// checked against the grant block alone, below.)
const PROPRIETARY_TERMS = [/PROPRIETARY/i, /confidential/i, /LICENSED, NOT SOLD/i];

test("the repo root and every published package are MIT-licensed, with no proprietary terms left behind", () => {
  // The root LICENSE is the single source (ADR 0018 via ADR 0025 §Decision.1); the package copies are
  // verbatim, so the terms are read ONCE here and byte-identity carries the rest.
  const source = fs.readFileSync(path.join(ROOT, "LICENSE"), "utf8");
  const text = source.replace(/\s+/g, " ");
  for (const [pattern, why] of MIT_TERMS) {
    assert.match(text, pattern, "repo root: LICENSE must " + why);
  }
  for (const pattern of PROPRIETARY_TERMS) {
    assert.doesNotMatch(text, pattern, "repo root: LICENSE must not keep proprietary/confidentiality terms — MIT is the published grant");
  }
  // "All rights reserved" is narrowed to the GRANT BODY — after "Permission is hereby granted", before
  // the disclaimer. Above that line it is the benign copyright-notice formulation ("Copyright (c) 2026
  // geda0. All rights reserved."), which countless MIT files carry; inside the grant it contradicts the
  // rights being given. Scoping to the whole grant BLOCK would not do: the copyright line sits in it.
  const grantBody = text.split(/THE SOFTWARE IS PROVIDED/i)[0].split(/Permission is hereby granted/i)[1] || "";
  assert.doesNotMatch(grantBody, /All rights reserved/i,
    "repo root: the LICENSE grant must not reserve rights MIT gives away in the same breath");
  // Nothing may be BOLTED ON below the disclaimer. Every check above is either a positive match or a
  // keyword blacklist, and byte-identity (below) would happily carry a rider applied to all four files —
  // so an appended term with no blacklisted word (the Commons Clause ships exactly this way, as a
  // paragraph under the MIT text) would ship invisibly. This anchor is what makes that impossible.
  assert.match(text.trim(), /OTHER DEALINGS IN THE SOFTWARE\.$/,
    "repo root: the LICENSE must END with the MIT text — an extra term appended below it would restrict the grant unnoticed");

  const targets = [{ label: "repo root", dir: ROOT }].concat(
    PKGS.map((name) => ({ label: name, dir: path.join(ROOT, "packages", name) })));

  for (const { label, dir } of targets) {
    const pj = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    assert.strictEqual(pj.license, "MIT", label + ": package.json must declare the SPDX id MIT, not SEE LICENSE IN LICENSE / UNLICENSED");

    const lic = path.join(dir, "LICENSE");
    assert.ok(fs.existsSync(lic), label + ": must ship a LICENSE file (npm includes it in the tarball; the terms travel with the package)");
    assert.strictEqual(fs.readFileSync(lic, "utf8"), source,
      label + ": LICENSE must be a VERBATIM copy of the root one — an appended extra term (e.g. 'no commercial use') would otherwise ship unnoticed");

    // The README is where a human reads the terms; the ADR named packages/team-tactics/README.md as the
    // line that contradicted MIT. The CLAIM is pinned, not the wording — a reworded MIT line passes.
    const readme = fs.readFileSync(path.join(dir, "README.md"), "utf8");
    assert.ok(readme.split("\n").some((line) => /\bMIT\b/.test(line) && /LICENSE/.test(line)),
      label + ": README must state the kit is MIT and point at LICENSE, on one line — the displayed terms must agree with the declared ones");
    assert.doesNotMatch(readme, /proprietary|all rights reserved/i,
      label + ": README must not keep the proprietary claim — it would contradict the MIT LICENSE shipping beside it");
  }
});

// package-lock.json is a FIFTH declaration site, and an unpinned one: npm copies each workspace's
// `license` into it, it ships in the `git archive` release tarball (no .gitattributes export-ignore),
// and licence scanners — `npm ls --json`, GitHub's dependency graph — read it rather than the LICENSE
// files. The expected keys are DERIVED from PKGS, not filtered out of the lockfile: filtering to the
// entries that happen to declare a license makes an ABSENT license invisible (npm omits the key when
// package.json has none), which is the likelier accident than a wrong spelling.
test("the lockfile declares MIT for every workspace it records, so scanners read the same license as the LICENSE files", () => {
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));
  const expected = [""].concat(PKGS.map((name) => "packages/" + name));   // "" is the root entry

  const wrong = expected
    .map((key) => [key || "<root>", (lock.packages || {})[key] && (lock.packages || {})[key].license])
    .filter(([, license]) => license !== "MIT")
    .map(([p, license]) => p + " declares " + JSON.stringify(license));
  assert.deepStrictEqual(wrong, [], "every workspace the lockfile records must declare MIT — a missing entry or absent license counts as wrong:\n  " + wrong.join("\n  "));
});
