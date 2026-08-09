# Output Contract — where artifacts go and what must never be written

Runtime contract for any Grimoire skill that writes files. Self-contained by design: a skill is
copied into several harnesses, so it must never depend on a file outside its own directory.

Referenced by: [SKILL.md](../SKILL.md), [CAPABILITY-SPEC-TEMPLATE.md](./CAPABILITY-SPEC-TEMPLATE.md).

## 1. Resolving an output root

Three roots exist: `specs`, `knowledge`, `compendium`. Resolve each independently. First hit wins:

1. An explicit path the user gave in this session.
2. Environment: `GRIMOIRE_SPECS_ROOT`, `GRIMOIRE_KNOWLEDGE_ROOT`, `GRIMOIRE_COMPENDIUM_ROOT`.
3. `roots` in `grimoire.config.json` at the repository root.

**A configured root that does not exist is an error.** Ask the user where it should be. NEVER create
it silently and NEVER fall back to the current directory — writing captured knowledge into an
unexpected place is worse than refusing to write at all.

One exception, for `compendium` only: when nothing above resolves and `compendiumRepository` (a git
URL) is set in `grimoire.config.json`, the publish script maintains its own managed clone under
`~/.grimoire/compendium` — cloning on first use. That is not a silent `mkdir` of a configured root;
nothing the user configured is missing. It is what makes a zero-setup machine work: the user answers
questions, and the tooling handles where the repository lives.

`knowledge` is expected to point at a **separate knowledge-base repository** of distilled OKF
concepts. `compendium` is expected to point at a **separate evidence repository** — the raw
interview transcript and the source documents the user supplied, one folder per capability, kept as
plain markdown and original file formats so a personal knowledge vault or a downstream tool (e.g. a
future skill generator) can consume the folder directly.

**These are deliberately not the same root.** `knowledge/` holds small, distilled, curated concept
files meant to be read by a running skill. `compendium/` holds the bulkier, unprocessed evidence
those concepts were drawn from — it does not go through OKF distillation, and its growth profile is
expected to be larger and messier. Mixing them would drag the knowledge base's git history and
Obsidian-browsing experience down with document churn that has nothing to do with it.

## 2. What goes where

| Artifact | Root | Rule |
|---|---|---|
| `<slug>-capability-spec.md` | `specs` | One file per capability. Never overwrite — see the collision rule in [CAPABILITY-SPEC-TEMPLATE.md](./CAPABILITY-SPEC-TEMPLATE.md) §1. |
| Concept files | `knowledge` | One concept per file. Path is the concept's identity. Distilled — see [KNOWLEDGE-CAPTURE-OKF.md](./KNOWLEDGE-CAPTURE-OKF.md). |
| Interview transcript | `compendium/<slug>/transcript.md` | The full Q&A, verbatim, in question order. Written once, at close — see §5. |
| Supplied source documents | `compendium/<slug>/documents/` | Stored as provided, one subdirectory per capability. Concepts in `knowledge/` link here rather than duplicating the content. |
| Design Record | inside the specification | Appendix A. NEVER in `knowledge/` or `compendium/`. Its "Raw transcript" field records the `compendium/<slug>/transcript.md` path. |

## 3. The compendium write and publish

At close, after the user approves the read-back (per
[GRILL-DISCIPLINE.md](./GRILL-DISCIPLINE.md) §10), write:

- `compendium/<slug>/transcript.md` — every question and answer, in order, including resolved
  `OPEN:`/`ASSUMPTION:` markers. This is the raw record the Design Record's rationale is built from.
- `compendium/<slug>/documents/<original-name>` — each document the user supplied, stored as given.
  Apply the same sensitivity rule as knowledge concepts: a document classified confidential, or
  containing secrets or personal data, is **never copied in** — write a short neutral note plus its
  `resource:` link instead.

Then publish, automatically — the user runs nothing:

```
grimoire compendium-push <slug> --auto
```

The script is the single governed path to the remote. It secret-scans every file (a hit blocks the
publish, no override exists), commits the slug to a `compendium/<slug>` review branch cut from the
remote's tip, pushes that branch — never `main`, never `--force` — and the compendium repository's
CI opens the pull request. A human reviews and merges on GitHub; nothing merges itself.

The close-protocol approval **is** the confirmation for this network write — that is why `--auto`
exists and why the script asks nothing further. Do not run it before the user has approved the
read-back.

If the publish fails (no network, no git access on this machine, scan hit), the artifacts remain
intact on local disk and the failure output says exactly what happened and how to retry. Report that
output to the user verbatim. NEVER attempt the push with raw git commands instead.

## 4. Writing rules

- **Confirm before writing.** Show the user what will be written and where. Wait for explicit
  approval.
- **Never overwrite.** If a target file exists, apply the collision rule or stop and ask.
- **No silent partial writes.** When a multi-file emit fails partway, report which files were written,
  which were not, and what state each root is in. A half-written bundle that reports success is worse
  than a clean failure.
- **Never write outside a resolved root.** No absolute paths, no `..` escapes.

## 5. Never written, anywhere

- Secrets, credentials, tokens, or keys.
- Real personal or regulated data. Examples are synthetic, always.
- The body of anything classified `sensitivity: confidential` — a short neutral summary plus a
  `resource:` link only. See [KNOWLEDGE-CAPTURE-OKF.md](./KNOWLEDGE-CAPTURE-OKF.md) §7.
- Fabricated business rules, contracts, or acceptance criteria. Those are `OPEN:`.
- Implementation artifacts — `SKILL.md`, manifests, prompt bodies. A specification that contains its
  own implementation has stopped being a specification.
