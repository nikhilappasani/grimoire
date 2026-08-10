# Changelog

## 0.6.0

### Added

- **`category` — a second classification axis.** `type` says what *shape* a fact is; `category` says
  what *area* it belongs to. Both are required, because either alone leaves a reader guessing: "a
  Playbook about release governance" and "a Playbook about naming standards" are the same shape and
  entirely different things. Shipped default: `Conventions`, `Domain Knowledge`, `External Systems`,
  `Persona`, `Behavioral` — replaceable wholesale with `categories` in `grimoire.config.json`.
  Concrete systems and roles (Jira, Jenkins, "Data Engineer") stay in `tags`; baking one
  organisation's tooling into the vocabulary would make it wrong for everyone else.

- **The capture header.** `transcript.md` now opens with frontmatter recording what no concept can:
  who was interviewed, **in what role**, when, and against which content and spec versions. A
  concept could only ever say `source_system: Tribal/interview` — never whose head the fact came
  from, which is usually the question a capture is reopened to answer. `interviewee_role` is not
  decoration: the same statement carries different weight from a Solutions Architect than from a QA
  Engineer. `grimoire compendium-push` refuses a capture whose header is missing or invalid.

- **Per-question category labels** in the transcript
  (`**Q (base.s5b.q15b)** · *External Systems* — …`), feeding a coverage summary at close. These are
  best-effort and deliberately **not** gated — blocking an emit over a labelling miss would trade a
  real output for bookkeeping. The header's `theme` and `categories` are the claim and are required;
  the labels are the evidence.

- **`base.s1.q0a` / `q0b`** — the interview now asks who it is speaking with and in what role,
  first. Unlike everything else in the transcript, nobody can reconstruct those later.

### Changed

- **`source_system` is enforced.** Its vocabulary was exported from `tools/lib/okf.js` and
  referenced nowhere, so `source_system: "Banana Stand"` validated with zero errors *and* zero
  warnings. Missing or invalid is now an error — provenance that fails open is not provenance.
- **`timestamp` is validated** as an ISO-8601 date. Malformed is an error, missing is a warning: a
  date that cannot be compared looks like provenance while supplying none.
- **Drift-checking generalised to all five vocabularies** (`type`, `category`, `source_system`,
  `access_state`, `sensitivity`). The old extractor searched for the first line containing "this
  list is authoritative" and worked only because `.includes` is case-sensitive and §3 happened to
  precede §8's identically-worded claim — a second documented vocabulary would have silently read
  the wrong table. Markers are now named per vocabulary.

### Fixed

- **A diverged staging copy was silently ignored.** Once a slug existed in the compendium clone,
  `compendium-push` never re-imported from the staging root — so editing a capture and re-publishing
  shipped the stale clone copy. The user would review what they wrote and publish something else.
  Divergence is now refused with both paths named; `--from` states which copy is authoritative and
  refreshes. Found while verifying this release, not by a test.

## 0.5.0

### Changed — breaking

- **An interview now writes everything under one compendium slug.** Concepts go to
  `compendium/<slug>/knowledge/` next to the transcript and documents they were drawn from, instead
  of to a shared `knowledge/` root.

  Reported from a real capture: a Rust interview put eight external sources into
  `knowledge/references/` in the tooling repo, with no indication which capability they belonged to.
  Two interviews in, a shared root with no per-capture boundary becomes unreadable — and a reviewer
  checking whether a concept is right needs the transcript line it came from and the document that
  backs it, which lived in a different repository.

- **The `knowledge` root is now downstream and nothing writes to it at capture time.** It is filled
  by the build step, when an approved capture becomes a skill. The shared base stays curated by
  construction instead of accumulating drafts from captures nobody merged. The root still resolves
  and a running skill still reads from it.

  The build step does not exist yet, so today the shared root stays empty. That is the correct
  state, not a gap.

### Added

- **`Reference` type.** For an external source of truth the capability cites but does not own — a
  book, a specification, a docs site. Without it, the Rust capture filed *The Rust Book* as a
  `Runbook` and the cheat sheet as a `Glossary Term`, because the vocabulary offered nowhere better.
  That gap is also why the interview invented a `references/` directory.

- **Folder-to-type enforcement.** `check-knowledge-bundle.js` now errors when a concept's directory
  disagrees with its `type`, against the mapping in `KNOWLEDGE-CAPTURE-OKF.md` §2. A concept's path
  is its identity, and the previous gate validated the type vocabulary while ignoring paths
  entirely — so a bundle with two invented directories passed with zero errors.

### Fixed

- **The Rust capture migrated to the new shape**: eight sources retyped `Runbook`/`Glossary Term` →
  `Reference`, the invented `protocols/` folded into `playbooks/` where its `Playbook` type belongs,
  and the `documents/README.md` links repointed — they used `../../../knowledge/`, which resolved
  only inside the Grimoire repo and was already broken on the published branch.

- **The Compendium repo's structure gate** accepts `<slug>/knowledge/**`; it would otherwise have
  rejected every capture written in the new shape.

## 0.4.1

### Fixed

- **LoreWeaver handed the publish command back to the user instead of running it.** Found by testing
  a real interview: at close it printed `grimoire compendium-push <slug>` as a next step, which
  defeats the entire premise — the user answers questions and approves, and types nothing.

  The cause was wording, not staleness or tooling. Step 7 said "Run `grimoire compendium-push <slug>
  --review`", which reads as easily as "this command gets run" as it does "you run it", and
  publishing feels like a user's decision, so handing it over is the natural misreading. There were
  five `NEVER` walls and none of them forbade delegating, while the README already promised "You
  don't type it" — a guarantee nothing in the skill actually made.

  - New wall: **NEVER ask the user to run a `grimoire` command.** YOU execute every one.
  - Step 7 names the actor in every clause rather than describing commands in the abstract.
  - `OUTPUT-CONTRACT.md` §3 states the reasoning and the failure mode: report, do not delegate.

  Anyone on 0.4.0 from the registry has this bug; 0.4.1 is the fix.

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

### Fixed

- **`grimoire preflight` did not run the test suite**, though its own help text said it did and
  `npm run preflight` does. Two doors onto the same gate, and the one that skipped tests still
  printed a pass — so whichever a contributor happened to use decided whether tests ran at all. The
  CLI now runs them first, refuses to report a pass if it cannot find the suite, and a test asserts
  the two entry points cover the same four gates.

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
