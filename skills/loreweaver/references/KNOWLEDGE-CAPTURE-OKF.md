# Knowledge Sourcing & Capture — Open Knowledge Format (OKF)

Domain capabilities live or die on knowledge that is rarely in the repository. It sits in wikis,
document stores, shared drives, code comments, or the heads of a few senior people. This file tells an
interviewing skill how to **find that knowledge, get it out, and package it** so a generated skill can
actually use it — and so it survives in version control.

This file is the **single source** for: the `type` vocabulary (§3), the knowledge-item field list
(§8), and the extraction and storage protocols. Nothing else restates them.

## 1. Why OKF

We capture knowledge as an **Open Knowledge Format bundle**: a directory of markdown "concept" files
with YAML frontmatter. OKF is vendor-neutral, human- and agent-readable, renders on GitHub, and lives
in version control next to what it describes.
Format background: <https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing/>

- **Just markdown, just files, just frontmatter** — no SDK, renders anywhere, diff-able in review.
- **`resource:` frontmatter plus inline links preserve provenance** — a concept keeps a live hyperlink
  back to its authoritative source.
- **Cross-links form a graph** — concepts reference each other with ordinary relative markdown links.
  This is how a complex capability stitches terms, diagrams, and playbooks together, and it is why the
  bundle drops cleanly into a personal knowledge vault without conversion.

## 2. Bundle shape

```text
knowledge/
├── index.md                    # entry point / progressive disclosure
├── glossary/
│   ├── index.md
│   └── <term>.md               # one concept per file
├── policies/
│   └── <policy>.md
├── playbooks/
│   └── <playbook>.md
└── log.md                      # chronological change history (optional)
```

One concept per file. **The file path is the concept's identity** — moving a concept breaks every link
to it, so choose the path deliberately.

## 3. Concept file format

```markdown
---
type: <Glossary Term | Policy | Playbook | Runbook | Diagram | Process | API | Dataset>
title: <human-readable name>
description: <one line — WHAT this is>
why: <one line — WHY it matters, or when it applies>
resource: <absolute URL back to the authoritative source, or omit if none>
tags: [<domain>, <subdomain>]
timestamp: <ISO-8601, when captured or last verified>
source_system: <Local file | Wiki | Document store | Code | Tribal/interview | Public docs>
access_state: <extracted | linked | pending>
sensitivity: <public | internal | confidential>
---

# <title>

<body: the captured knowledge, in markdown. Cross-link related concepts with relative links,
e.g. see [Retention Window](../policies/retention-window.md).>
```

**`type` vocabulary — this list is authoritative.** Any other value is a validation error.

`Glossary Term` · `Policy` · `Playbook` · `Runbook` · `Diagram` · `Process` · `API` · `Dataset`

`type` is the only field OKF strictly requires. The rest are house conventions that make the bundle
queryable and traceable. `description` and `why` exist because a knowledge base that only says *what*
a thing is forces every future reader to re-derive *why* anyone wrote it down.

## 4. What is NOT knowledge

The bundle holds only what a **generated skill would read at runtime**. These are artifacts, and they
belong with the specification — never in `knowledge/`:

- The interview Q&A or transcript → the specification's **Design Record** appendix.
- Design rationale, rejected alternatives, resolved assumptions → Design Record.
- The Capability Specification itself → `specs/`.

> **Litmus test:** *would the running skill read this file to do its job?*
> Yes → knowledge. No, it is about how the skill was designed → artifact.

## 5. Extraction protocol — by where the knowledge lives

Cover every source. Each item lands in exactly one lane.

| Source | Agent can read it? | Protocol |
|---|---|---|
| **Local file in the workspace** | Yes | Read it, distill the durable knowledge into concept file(s), keep a relative link. Do not copy wholesale. |
| **Auth-gated wiki / document store / intranet** | **No** | **Ask the user to extract** and paste or attach the relevant content. Record the page URL in `resource:`. Never guess the content behind a link you cannot open. |
| **Code, comments, docstrings** | Yes, if in the workspace | Summarize the rule or contract into a concept; link to file and line. |
| **Tribal — in someone's head** | No | Interview it out, one fact at a time. Mark unverified facts `OPEN:` until confirmed. |
| **External public docs** | Sometimes | If reachable and non-sensitive, cite with `resource:` plus a short distilled summary. Otherwise ask the user. |

**Never fetch auth-gated content on the user's behalf.** Capture the link, record
`access_state: pending`, and let the user supply the content.

## 6. Storage decision — bundle or link

Decide per concept. The two lanes are mutually exclusive.

| Choose | When | What lands in the bundle |
|---|---|---|
| **Bundle** (full body) | `sensitivity: public` or `internal`, stable, and useful to search offline | A concept file with the distilled knowledge in the body, plus `resource:` back to source |
| **Link-only** (stub body) | `sensitivity: confidential`, contains secrets or personal data, is volatile, or is very large | A concept file that is a **short neutral summary** plus `resource:` — no sensitive content in the body |

Default to bundling when it is safe: an indexed concept is searchable, diff-able, and loads
just-in-time. Fall back to link-only the moment sensitivity or volatility makes a copy risky or stale.
**When unsure, link.**

## 7. Hard rules during extraction

- **Never fabricate.** If knowledge is gated and the user has not provided it, record the concept as a
  stub with `resource:` and `OPEN:`. Do not invent the body.
- **Confidential is link-only — no exceptions.** Content marked `sensitivity: confidential`, or
  containing secrets or personal data, is **never** copied into a concept body, even in a private
  repository. Store a short neutral summary plus the `resource:` link. This is a hard rule, not a
  preference, and `check-knowledge-bundle.js` enforces it as an error.
- **Prefer link over copy for volatile or large sources.** A stable hyperlink plus a distilled summary
  beats a stale full copy.
- **Attribution.** Every concept states where it came from via `source_system` and `resource:`, so a
  reviewer can trace it back.

## 8. Field list handed to the generator

For each knowledge item the specification must carry exactly these fields. This list is authoritative;
`INTERVIEW.md` and `CAPABILITY-SPEC-TEMPLATE.md` reference it rather than restating it.

| Field | Values |
|---|---|
| `title` | free text |
| `type` | the §3 vocabulary |
| `source_system` | Local file \| Wiki \| Document store \| Code \| Tribal/interview \| Public docs |
| `resource` | absolute URL, or `none` |
| `access_state` | extracted \| linked \| pending |
| `sensitivity` | public \| internal \| confidential |

Pending items stay `OPEN:` stubs until the user provides the content.

## 9. Packaging

- Keep `resource:` as **absolute** URLs so they resolve wherever the bundle is published.
- Keep cross-concept links **relative** (`../glossary/term.md`) so they resolve inside the repository
  and inside a local vault.
- The bundle is referenced from a generated `SKILL.md` via progressive disclosure — the skill loads one
  concept just-in-time rather than inlining all knowledge.
- Source documents the user supplied during the interview are filed under the configured
  `compendium` root, not inside `knowledge/`. The concept links to them; the bundle stays distilled.
  See [OUTPUT-CONTRACT.md](./OUTPUT-CONTRACT.md) §3.
