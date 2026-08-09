# Changelog

## 0.4.0

### Added

- **Content review before publishing.** `grimoire compendium-push <slug> --review` prints the actual
  text of every artifact — the full transcript, each supplied document, binary files described
  rather than dumped — plus a short digest of exactly those bytes. It writes nothing and pushes
  nothing. Rationale: 0.3.0 confirmed a *file list*, and under `--auto` confirmed nothing at all, so
  a capture could reach a remote without anyone having read it. Publishing is irreversible in the
  way that matters: content that reached a remote has been seen, cached, and possibly indexed even
  if the branch is deleted minutes later.
- **`contentDigest()` in `compendium-git.js`** — a 12-character fingerprint over the sorted
  (path, length, bytes) of the capture. Sorted so it does not depend on directory-walk order, which
  is locale-sensitive; length-delimited so a file boundary cannot be moved without detection; keyed
  on paths as well as content so a rename changes it.

### Changed

- **`--auto` now requires `--reviewed <digest>`.** It never meant "approved" — it meant "there is no
  terminal here" — but nothing enforced the difference. The script recomputes the digest from disk
  before pushing and refuses if it moved, so an approval is bound to the exact bytes a human read
  rather than to a filename or a promise. A missing or stale digest fails at step 5 with nothing
  pushed. **This is a breaking change to the publish flow**; `--auto` alone is now an error.
- **The interactive path shows content too**, not just filenames: the first 40 lines of each text
  artifact, with the truncation stated and `--review` offered for the rest.
- **Step 5 renamed `confirm` → `confirm content`**, and artifacts are now read once as bytes and
  shared by the secret scan, the digest, and the review display — so all three are guaranteed to
  describe the same content rather than three separate reads of a file that could change between
  them.
- **`SKILL.md` gained a wall: never publish content the user has not read.** Step 7 is now two
  commands with an explicit approval between them. The close-protocol approval covers the
  specification; it was never approval to publish the raw transcript and the user's own documents.

## 0.3.0

### Added

- **`grimoire compendium-push <slug>` — automatic publishing of a capture.** LoreWeaver runs it at
  interview close with `--auto`; the user types nothing. It resolves the Compendium clone, imports
  the slug, secret-scans every file, commits to a `compendium/<slug>` review branch cut from the
  remote's tip, and pushes that branch. The compendium repository's CI opens the pull request.
  Rationale: the artifacts were previously stranded on local disk, and the manual alternative
  (`gh` installed, authenticated, plus knowing the branch convention) is exactly the hassle a
  subject-matter expert should never have to care about.
  - `scripts/compendium-push.js` — the only sanctioned network-write git path in Grimoire.
  - `tools/lib/compendium-git.js` — pure helpers (secret patterns, remote parsing, branch collision
    resolution, root planning) with no process or filesystem access, so every rule guarding a
    network write is unit-testable without touching git.
  - `tools/__tests__/compendium-git.test.js` and `compendium-push.integration.test.js` — the latter
    runs the real script end-to-end against a throwaway bare-repo pair under `os.tmpdir()`, fully
    offline.
- **`compendiumRepository` in `grimoire.config.json`.** When set and no `compendium` root resolves,
  the publish script maintains a managed clone at `~/.grimoire/compendium`, cloning on first use.
  This is the deliberate exception to the never-create-a-root rule: nothing the user configured is
  missing, and it is what makes a machine with zero prior setup able to publish.
- **`OUTPUT-CONTRACT.md` §3** now covers the publish, not just the local write, including that the
  close-protocol approval *is* the confirmation for the network write.
- **Troubleshooting and a "Publishing a capture" section in `README.md`**, including why no `gh`
  CLI is required: the pull request is opened server-side by the compendium repo's workflow using
  the token GitHub Actions already has, so the interviewing machine needs git push access and
  nothing else.

### Changed

- **`SKILL.md`'s git wall is now specific.** Previously "never push to git"; now "never touch git
  except through `grimoire compendium-push`", plus never merge, close, or approve a pull request.
  The blanket ban became wrong the moment a governed publish path existed — a wall that
  contradicts the workflow is a wall the model will route around.
- **Package renamed to `@nikhilappasani/grimoire`.** The unscoped name is taken on the public
  registry. `validate-plugin.js` now accepts a scope in `package.json`'s `name` (skill directory
  names still may not carry one).

### Guarantees enforced in code, not prose

- A secret-scan hit blocks the publish. There is no override flag.
- `main` is never pushed to, and `--force` is never used.
- An existing branch is never overwritten — collisions get `-<YYYYMMDD>`, then `-2`, `-3`.
- Unrelated dirty state in the clone blocks the publish rather than being swept into the commit.
- A mid-run failure names the step that failed and the state of the clone; artifacts stay on disk.

## 0.2.0

### Changed

- **`docs` root renamed to `compendium`, and its scope expanded.** It now holds the interview
  transcript (`compendium/<slug>/transcript.md`) alongside supplied documents
  (`compendium/<slug>/documents/`), not documents alone. Rationale: these were already the same
  concept — "what a curation team needs to build a skill from an interview" — and giving them
  separate roots risked the same kind of collision M-3 fixed for "Domain Knowledge." `compendium` is
  meant to point at its own repository, distinct from the `knowledge` repository of distilled
  concepts, since its growth profile (raw, bulky evidence) is deliberately different.
  - `GRIMOIRE_DOCS_ROOT` → `GRIMOIRE_COMPENDIUM_ROOT`.
  - `roots.docs` → `roots.compendium` in `grimoire.config.json`.
  - `docs/sources/` → `compendium/` in the default layout.
- **`content_version` and `spec_version` bumped to 0.2.0** across the reference bundle, reflecting
  the output-contract and template changes above.
- **`SKILL.md` now states the "never push to git" wall explicitly.** It was previously enforced only
  by omission (no push capability existed) and described in conversation, not written into the skill
  itself. Added as a named wall alongside the others, since `compendium/` writes make the boundary
  between "write locally" and "push to a remote" load-bearing for the first time.

### Added

- `OUTPUT-CONTRACT.md` §3 — the compendium write: what LoreWeaver writes at close, and the explicit
  statement that the write is local and stops there.
- `CAPABILITY-SPEC-TEMPLATE.md`'s Design Record "Raw transcript" field now points at the concrete
  `compendium/<slug>/transcript.md` convention instead of an unspecified path.

## 0.1.0

First release. LoreWeaver only.

### Added

- **`loreweaver` skill** — role-aware interview emitting a Capability Specification plus an OKF
  knowledge bundle.
- **Reference content layer** (`content_version` 0.1.0):
  - `GRILL-DISCIPLINE.md` — the interview epistemics, factored out so a future grill inherits them
    rather than forking them.
  - `INTERVIEW.md` — 10 base sections, every question carrying a stable ID.
  - `ROLE-QUESTION-BANKS.md` — 9 execution-subtype banks, 6 persona banks, and a universal
    deep-probe bank.
  - `CAPABILITY-SPEC-TEMPLATE.md` — emit format, naming and collision rules, quality bar.
  - `KNOWLEDGE-CAPTURE-OKF.md` — extraction and storage protocol; the single source for the `type`
    vocabulary and the knowledge-item field list.
  - `OUTPUT-CONTRACT.md` — root resolution and the never-write rules.
- **`tools/lib/`** — one frontmatter parser, one link checker, one OKF rule set, consumed by every
  validator.
- **Validators** — `validate-plugin.js`, `lint-skills.js`, `check-knowledge-bundle.js`.
- **`scripts/sync-skills.js`** — generates artifacts for Claude Code, Codex, Copilot/VS Code, and pi
  from the `SKILL.md` sources. `--check` gates drift.
- **`scripts/install.js`** — sandboxed by default, with rotating backups.
- **`bin/grimoire.js`** — CLI: `sync`, `install`, `validate`, `lint`, `check-knowledge`, `preflight`.

### Corrections applied to the seed content

Carried over from the reference-pack review; each was a known defect in the prior implementation.

| ID | Correction |
|---|---|
| M-1 | OKF `type` vocabulary single-sourced in `KNOWLEDGE-CAPTURE-OKF.md`; `check-knowledge-bundle.js` enforces it as an enum and fails on drift between the document and the code. |
| M-2 | All nine evaluation dimensions enumerated with definitions where the user sees them, and read aloud before the ranking question. |
| M-3 | The Enterprise Knowledge subsection renamed **Business/Domain Facts Required**, so it no longer collides with the Capability Category "Domain Knowledge". |
| M-4 | Installer rewritten: sorted file lists, allow-listed `--target`, per-step failure-state reporting, `--dry-run`. |
| I-2 | Grill rules and the quality bar cross-reference instead of restating each other. |
| I-3 | Stable question IDs and `content_version` added at seed time. |
| I-4 | The universal deep-probe bank — referenced but absent in the prior implementation — written. |
| I-5 | Unmatched roles surface as `bank matched: none (universal fallback used)`. |
| I-6 | Repository layout stated as a contract in `CONVENTIONS.md` and enforced by the validators. |

### Notes

- The healthcare-payer framing of the prior implementation is gone. The safety rules it motivated are
  not: no real personal or regulated data, confidential is link-only, never fabricate, confirm before
  irreversible actions.
- Skills must be self-contained — no relative link may escape a skill directory, because skills are
  copied verbatim into every harness target. `lint-skills.js` enforces this.
