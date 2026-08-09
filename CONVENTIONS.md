# Grimoire Conventions

Binding rules for anything added to this repository. Where a skill body and this file disagree, this
file wins and the skill is the defect.

## 1. Repository layout (this layout is a contract)

Relative links inside skills resolve against it. Changing it silently breaks every reference.

```text
grimoire/
├── package.json                 # npm manifest; version is the release version
├── grimoire.config.json         # content version, output roots, harness targets
├── CONVENTIONS.md               # this file
├── bin/grimoire.js              # CLI entry: sync | install | validate
├── skills/
│   └── <skill-name>/
│       ├── SKILL.md             # the only source of truth for the skill
│       └── references/          # progressive-disclosure detail, loaded on demand
│           └── *.md
├── tools/
│   ├── lib/                     # shared parsers — never duplicated in a validator
│   ├── validate-plugin.js
│   ├── lint-skills.js
│   ├── check-knowledge-bundle.js
│   └── __tests__/               # fixtures + node:test runner
├── scripts/
│   ├── sync-skills.js           # SKILL.md → per-harness artifacts
│   └── install.js               # local install, sandbox by default
├── specs/                       # emitted Capability Specifications
├── knowledge/                   # emitted OKF knowledge bundle
└── compendium/                  # emitted interview transcripts + supplied documents
```

`specs/`, `knowledge/`, and `compendium/` are **output roots**, not source. Their real location is
resolved per §6 — the paths above are only the defaults.

## 2. Skill naming

- Directory name is the skill name: lowercase, kebab-case, no spaces.
- Names are **verb-noun pairs**: `forge-skill`, `curate-lore`, `publish-spec`.
- `loreweaver` is a documented exception. It is the flagship and the product name; it keeps it.
  Adding a second exception requires adding it to this list, with a reason.

| Exception | Reason |
|---|---|
| `loreweaver` | Flagship skill and the name the product is known by. |

## 3. SKILL.md discipline

- **Under 100 lines.** Detail goes to `references/`, loaded on demand. A skill body that must be read
  in full on every invocation is a tax on every session that never uses it.
- **Frontmatter is an allow-list:** `name`, `description`, `model`, `effort`, `content_version`,
  `disable-model-invocation`. Anything else is a lint error.
- **`description` is the selection object** — the only field an agent sees when choosing a skill.
  - Max 1024 characters, third person.
  - States the capability, then `Use when …` triggers.
  - Never contains workflow steps, numbered phases, or gate prose. Those go in the body.
- **Instructional prose is imperative and directive.** Use MUST, MUST NOT, NEVER, ALWAYS. Avoid
  should, might, consider, generally — a hedge in a skill body is a rule an agent will skip.
- Every relative link must resolve. `lint-skills.js` enforces this case-sensitively.

## 4. Content versioning

The reference bundle under `skills/*/references/` is **content**, not code. It versions separately.

- `contentVersion` in `grimoire.config.json` is one semver across the whole reference bundle.
- `specVersion` is the Capability Specification template's schema version. Every emitted spec carries
  it in frontmatter so a template bump can flag stale specs later.
- Every interview question carries a stable ID: `<bank>.<section>.<seq>` — `base.s4.q11`,
  `diagnostic.q2`, `data-engineer.q3`. IDs are assigned once and **never reused**.
- Rewording a question **keeps** its ID. Replacing its intent **retires** the ID and issues a new one.
  Retired IDs stay resolvable so historical answers still map.
- Every content release records, per changed question: kept / reworded / replaced / added / retired.

## 5. Single-source rules

Duplication across reference files drifts silently. Each of these has exactly one home:

| Fact | Single source | Everyone else |
|---|---|---|
| OKF `type` vocabulary | `KNOWLEDGE-CAPTURE-OKF.md` | references it by name |
| Rules of the grill | `GRILL-DISCIPLINE.md` | references it by name |
| Nine evaluation dimensions | `CAPABILITY-SPEC-TEMPLATE.md` §8b | references it by name |
| Knowledge-item field list | `KNOWLEDGE-CAPTURE-OKF.md` | references it by name |

## 6. Output roots

Emitted artifacts do not necessarily land in this repo. The **runtime contract is
`skills/loreweaver/references/OUTPUT-CONTRACT.md`** — that file is the single source, because a skill
gets copied into several harnesses and must not depend on anything outside its own directory. This
section summarizes it for contributors; it does not restate the rules authoritatively.

Roots are `specs`, `knowledge`, and `compendium`, each resolved from an explicit session path, then a
`GRIMOIRE_*_ROOT` environment variable, then `grimoire.config.json`. A configured root that does not
exist is a fail-closed error, never a silent `mkdir -p`. `compendium` holds the raw interview
transcript and supplied documents — a separate, bulkier root from `knowledge`'s distilled concepts,
on purpose (§8's confidential-is-link-only rule applies to both).

**A skill's relative links must never escape its own directory.** `lint-skills.js` enforces this.

### 6a. The one path that writes to a remote

`scripts/compendium-push.js` is the **only** code in this repo permitted to run a network-write git
operation, and `tools/lib/compendium-git.js` holds its decision logic as pure functions — no
spawning, no filesystem — so every rule guarding that write is unit-testable without touching git.

If you add a feature that needs to reach a remote, extend that script. Do not add a second one, and
do not spawn git from a skill: the value of a single governed path is that reviewers have exactly
one file to audit. Its guarantees — secret scan with no override, never `main`, never `--force`,
never merge, never overwrite an existing branch — are enforced in code and covered by
`tools/__tests__/compendium-push.integration.test.js`, which runs the real script against a
throwaway bare-repo pair. Changing any of them means changing that test, deliberately.

## 7. Generated artifacts

`scripts/sync-skills.js` generates per-harness copies of every `SKILL.md`. Targets:

| Harness | Output |
|---|---|
| Claude Code | `.claude/skills/<name>/` |
| Codex | `.codex/skills/<name>/` |
| Copilot / VS Code | `.copilot/skills/<name>/` |
| pi | `.pi/skills/<name>/` + `.pi/prompts/<name>.md` |

**Never edit a generated artifact.** Edit `skills/<name>/SKILL.md` and re-run sync. Generated
directories are gitignored; the source is the only thing reviewed.

## 8. Safety posture

These are inherited by every skill in the suite and are not per-skill choices:

- **Never fabricate.** Missing rule, contract, or acceptance criterion becomes `OPEN:`. An inference
  becomes `ASSUMPTION:` and gets confirmed out loud.
- **Confidential is link-only, no exceptions.** Content classified confidential, or containing
  secrets or personal data, is never copied into a knowledge body — a short neutral summary plus a
  `resource:` link.
- **No real personal data.** Examples are synthetic, always.
- **Confirm before irreversible or network-affecting actions.**
- **No silent partial writes.** A multi-step write that fails mid-run reports which step failed and
  what state each target is in.

## 9. Definition of done

A change is done when `npm run preflight` exits 0 — tests, then plugin validation, then skill lint,
then the knowledge-bundle gate. Narration without that output is not evidence.
