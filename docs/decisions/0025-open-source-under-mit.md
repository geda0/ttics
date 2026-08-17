# 0025 — ttics goes open source under MIT (the proprietary terms are withdrawn; the pinning test inverts)

- Status: **Accepted** — a licensing decision, docs-only in this ADR. The edits it requires (the four
  `LICENSE` files, the four `package.json` `license` fields, the README/FOR-TESTERS wording, and the
  inverted pinning test) go through the red→green gate afterwards, pinned by the predicates in §4.
- Date: 2026-08-17
- Deciders: navigator (the call, made and not re-opened here — ttics ships open source under MIT,
  copyright holder unchanged: `geda0` <geda071@gmail.com>, 2026), architect (records the seam: what the
  flip reverses, what survives it, and the fact that it is one-way).
- Relates to: **0017 (judgment gates stay mechanical)** — "which license?" is a judgment; what a test can
  pin is the *predicate* ("the declared license is exactly this, in every package, and the file ships"),
  and that predicate is what survives the flip. **0018 (single source of truth)** — the root `LICENSE` is
  the source; the three package copies are verbatim copies of it, and must be flipped together or the
  packages disagree with the repo. **Supersedes no ADR** — the proprietary terms were never recorded in
  one. They arrived in **v0.23.0** (2026-06-05 — the release that added a proprietary `LICENSE` while
  `@ttics/tics` + `@ttics/tdd` stayed MIT) and lived only as a test assertion. That absence is half the reason this ADR
  exists: a licensing flip must be legible somewhere other than a test diff.

## Context

The project's own license history is a loop. It opened **MIT** at its first commit (2026-06-03), turned
**proprietary** two days later (v0.23.0, 2026-06-05), and this ADR turns it back. The proprietary terms carried an explicit,
load-bearing argument — stated at the top of `LICENSE` and restated verbatim in the header of
`packages/team-tactics/test/license.test.js`:

> The framework ships as readable source (a local agent kit can't hide it), so the protection is
> **legal, not technical**.

That reasoning was sound on its own terms and is exactly what is now **abandoned**. A local agent kit is
still unhideable — nothing about the technical situation changed — but we no longer want the legal
substitute for a technical wall. Everything the proprietary terms bought (§2's confidentiality,
no-redistribution, no-derivatives, non-compete, and the "authorized in writing" grant) was bought at the
cost of the thing this project actually wants: adopters who can fork it, read it in the open, and build on
it. The distribution posture it was written for — `FOR-TESTERS.md`, a private tarball to selected peers
(v0.24.0; the posture is recorded in that file) — is no longer the posture.

## Decision

**ttics is licensed under the MIT License.** Copyright holder unchanged: `Copyright (c) 2026 geda0`.

1. The **MIT text replaces the proprietary text** in the root `LICENSE` and, verbatim, in
   `packages/tics/LICENSE`, `packages/tdd/LICENSE`, `packages/team-tactics/LICENSE` (0018: one source,
   copied, never diverging).
2. **`"license": "MIT"`** in every `package.json` — root, `tics`, `tdd`, `team-tactics` — replacing
   `"SEE LICENSE IN LICENSE"` (which is npm's *proprietary* spelling and would now be a lie).

### What this reverses (explicitly, clause by clause)

Every restriction in the old `LICENSE` is **withdrawn**:

| old clause | after MIT |
|---|---|
| §1 grant, only to someone "authorized in writing" | no authorization needed; the grant runs to anyone who has a copy |
| §2(a) no copy / distribute / publish / mirror / host | permitted |
| §2(b) no sublicense / assign / transfer | permitted (MIT names sublicensing outright) |
| §2(c) no derivative works | permitted — fork and modify freely |
| §2(d) no competing product built on it or its know-how | permitted — **including tooling that competes with ttics** |
| §4 confidentiality | gone; there is nothing confidential in this repo |
| §5 termination on breach / on notice | gone; MIT is not revocable per-licensee |

**The only surviving obligation is attribution**: keep the copyright notice and the permission notice in
copies and substantial portions. Two things carry over unchanged in substance because MIT states them too —
the **AS-IS warranty disclaimer** (old §6) and the **limitation of liability** (old §7).

### What does NOT change

- **The `LICENSE` file still ships in every package tarball.** npm includes `LICENSE` regardless of the
  `files` allowlist, and the invariant is unchanged in shape: *the terms travel with the package.* Only
  their content changes. This is the invariant the test has always been protecting; it is not what flipped.
- **The publishing flow.** Still GitHub-release tarball; **no public npm publish is enabled by this ADR.**
  MIT permits redistribution; it does not, by itself, push anything anywhere. Enabling npm publish is a
  separate decision with its own ADR.
- **The copyright holder.** `geda0` still owns the code. MIT licenses it; it does not assign it.

### The pinning test inverts (and that is the point)

`packages/team-tactics/test/license.test.js` today asserts the **negative** — no package may regress to
"MIT/permissive", the root `LICENSE` must match `/PROPRIETARY|All rights reserved/i`, and each
`package.json` `license` must be `SEE LICENSE IN LICENSE` or `UNLICENSED`. Post-flip it asserts the
**positive**: `license === "MIT"` in all four `package.json`s, and every `LICENSE` file carries the MIT
text (`MIT License` + the permission notice + the AS-IS disclaimer). Its header comment — which still
recites the abandoned "protection is legal, not technical" reasoning — must be rewritten to cite this ADR.

The test's *assertion* reverses; its **invariant does not**. That invariant is: **the license is a
deliberate, uniform, tested state — never a default, never per-package drift, and never changed silently.**
It is the same guarantee running in the opposite direction, which is exactly why the flip has to touch the
test: a license nobody pins is a license nobody decided.

### The published repo starts at the relicense (the history is dropped, not rewritten)

The flip ships as a **re-founding**: ttics is published from a fresh repository whose first commit is the
MIT-licensed tree. There is **no pre-MIT history in it, by construction** — not squashed, not rewritten,
simply not carried across. This is the same decision's mechanics, not a separate one, which is why it is
recorded here: the history is cut **at** the relicense boundary so that the published history contains only
MIT-licensed commits.

- **What it buys.** Every commit in this repo is MIT. Nobody clones a history full of "all rights reserved"
  and then has to reason about which commit they may reuse, or whether a `git checkout` of an older tree
  lands them under the old §2. The answer never depends on where in the history you are standing.
- **What it costs — stated plainly.** ~140 commits of authorship and rationale are no longer reachable from
  this repo, **including the evidence trail behind ADRs 0001–0024**: the slice-by-slice red→green sequence,
  the commit messages, the diffs a decision was actually derived from. The ADRs remain the record; the
  commits behind them do not. Anyone auditing *why* a decision was made reads the ADR, not `git log`, and
  cannot cross-check the ADR against the work it describes. That is a real reduction in provenance — the
  documents now stand alone, unbacked by the trail — and it is not dressed up here.
- **Abandoned, not destroyed.** The old history still exists in the original working copy. It is offline and
  unpublished, not deleted; it is simply not what anyone clones.
- **No SHAs in these docs.** A commit SHA cited in an ADR is a dangling pointer in this repo — `git show`
  returns nothing. Historical facts are therefore cited by **version + date + the document that records the
  same event** (e.g. "v0.23.0, 2026-06-05" above; ADR 0013 for E12 in `0015` §Risks; v0.61.0 in `0024` §9).
  Keep it that way: durable citations, no repo-local pointers.

## Consequences

- **The one-way door — stated plainly, because it is the main cost.** MIT is **irreversible for every
  version released under it.** Once a release is published under MIT, that release is MIT forever; the
  grant cannot be withdrawn from anyone who already has a copy. A future decision to re-proprietarize can
  only bind **new versions**, and **forks of the MIT-licensed releases remain fully legitimate** — free to
  continue, diverge, and compete, using the code and the method it embodies. There is no recall. The
  navigator has made this call knowing that; this ADR records it so no one later mistakes the door for a
  hinge. (The project already has one such fossil: the releases **before v0.23.0 were MIT** and the v0.23.0
  relicense never reached them — those copies stayed MIT and still are. The claim is true and unchanged;
  note only that it is a fact about the *project's* past, which **this repo can no longer evidence from its
  own history** — see §"The published repo starts at the relicense". The supporting record is now external:
  the abandoned working copy and the released tarballs held by their recipients.)
- **Anyone may fork, modify, redistribute, and build competing tooling** on ttics. That is not a side
  effect to be mitigated — it is the decision. The defensible asset moves from a legal restriction to the
  ordinary open-source ones: the method, the pace, and being the canonical upstream.
- **Adopter friction drops to attribution.** No written authorization, no confidentiality obligation, no
  "am I allowed to vendor this into our monorepo?" — the answer is yes, keep the notice.
- **Third-party review, reuse, and quoting become legal** — an issue reporter may paste hook source into a
  public bug report; the docs may be quoted; a talk may show the code. All of that was a §2/§4 breach
  before.
- **The private-distribution wording is now false and must follow.** `FOR-TESTERS.md` ("private,
  proprietary, pre-release … please do not redistribute") and
  `packages/team-tactics/README.md:161` ("Proprietary — © 2026 geda0. All rights reserved.") contradict
  MIT the moment the `LICENSE` files flip, as does the `distribution.test.js` assertion that pins the
  "reminds testers it's private" wording. Filed as drift **`D-0025-proprietary-wording`** — the loop takes
  it in the same slice as the flip, not after; the repo must never sit in a state where the terms and the
  prose disagree.
- **No mechanism changes.** No hook, no tic kind, no contract, no runtime dependency, no `files` list. The
  gate, the bus, and the installer are untouched by this ADR.

## Migration note

There is nothing for an adopter to *do*, and nothing breaks: MIT is strictly more permissive than the
terms it replaces, so every use that was licensed yesterday remains licensed today. An adopter who holds a
pre-flip tarball keeps the proprietary terms **for that copy** (terms travel with the package — §"what does
not change") and gets MIT on the next `ttics update` / release they take. The four `LICENSE` files and the
four `package.json` fields must land in **one commit** — a half-flipped repo (root MIT, packages
proprietary, or vice versa) is a contradiction shipped to users, and is precisely what the inverted test
exists to prevent.

## Out of scope

- **Enabling `npm publish`.** Unchanged by this ADR (see above). Separate decision, separate ADR.
- **A CLA, a DCO, or a contribution policy.** MIT licenses the *outbound* code; taking outside patches
  raises inbound questions this ADR does not answer.
- **Trademark.** MIT covers copyright only. "ttics" / "team-tactics" as names are not licensed here and
  not decided here.
- **Choosing a different permissive license** (Apache-2.0's patent grant, BSD-3's no-endorsement clause).
  The navigator chose MIT; this ADR records that choice rather than re-deriving it.
