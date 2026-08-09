# Changelog

## 0.1.0 — unreleased

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
