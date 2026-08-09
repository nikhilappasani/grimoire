# Output Contract — where artifacts go and what must never be written

Runtime contract for any Grimoire skill that writes files. Self-contained by design: a skill is
copied into several harnesses, so it must never depend on a file outside its own directory.

Referenced by: [SKILL.md](../SKILL.md), [CAPABILITY-SPEC-TEMPLATE.md](./CAPABILITY-SPEC-TEMPLATE.md).

## 1. Resolving an output root

Three roots exist: `specs`, `knowledge`, `docs`. Resolve each independently. First hit wins:

1. An explicit path the user gave in this session.
2. Environment: `GRIMOIRE_SPECS_ROOT`, `GRIMOIRE_KNOWLEDGE_ROOT`, `GRIMOIRE_DOCS_ROOT`.
3. `roots` in `grimoire.config.json` at the repository root.

**A configured root that does not exist is an error.** Ask the user where it should be. NEVER create
it silently and NEVER fall back to the current directory — writing captured knowledge into an
unexpected place is worse than refusing to write at all.

`knowledge` is expected to point at a **separate knowledge-base repository**. `docs` holds the source
documents the user supplied during an interview, kept as plain markdown with YAML frontmatter and
relative links so a personal knowledge vault can consume the folder directly.

## 2. What goes where

| Artifact | Root | Rule |
|---|---|---|
| `<slug>-capability-spec.md` | `specs` | One file per capability. Never overwrite — see the collision rule in [CAPABILITY-SPEC-TEMPLATE.md](./CAPABILITY-SPEC-TEMPLATE.md) §1. |
| Concept files | `knowledge` | One concept per file. Path is the concept's identity. |
| Supplied source documents | `docs` | Stored verbatim as provided. Concepts link to them; the bundle stays distilled. |
| Design Record | inside the specification | Appendix A. NEVER in `knowledge`. |

## 3. Writing rules

- **Confirm before writing.** Show the user what will be written and where. Wait for explicit
  approval.
- **Never overwrite.** If a target file exists, apply the collision rule or stop and ask.
- **No silent partial writes.** When a multi-file emit fails partway, report which files were written,
  which were not, and what state each root is in. A half-written bundle that reports success is worse
  than a clean failure.
- **Never write outside a resolved root.** No absolute paths, no `..` escapes.

## 4. Never written, anywhere

- Secrets, credentials, tokens, or keys.
- Real personal or regulated data. Examples are synthetic, always.
- The body of anything classified `sensitivity: confidential` — a short neutral summary plus a
  `resource:` link only. See [KNOWLEDGE-CAPTURE-OKF.md](./KNOWLEDGE-CAPTURE-OKF.md) §7.
- Fabricated business rules, contracts, or acceptance criteria. Those are `OPEN:`.
- Implementation artifacts — `SKILL.md`, manifests, prompt bodies. A specification that contains its
  own implementation has stopped being a specification.
